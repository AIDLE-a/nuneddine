import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, updateProfile } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject, listAll } from "firebase/storage";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, increment,
  collection, getDocs, deleteDoc,
  query, orderBy, limit, serverTimestamp,
  runTransaction,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

// ── 닉네임 (중복 체크 + Firestore 저장) ──

export async function isNameTaken(name, currentUid) {
  const ref = doc(db, "usernames", name);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  return snap.data().uid !== currentUid; // 본인 이름이면 false
}

export async function updateDisplayName(user, newName) {
  const oldName = user.displayName;
  const usernameRef = doc(db, "usernames", newName);
  const userRef = doc(db, "users", user.uid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(usernameRef);
    if (snap.exists() && snap.data().uid !== user.uid) {
      throw new Error("이미 사용 중인 이름입니다.");
    }
    // 새 이름 등록
    tx.set(usernameRef, { uid: user.uid });
    // 이전 이름 삭제
    if (oldName && oldName !== newName) {
      tx.delete(doc(db, "usernames", oldName));
    }
    // users 문서에도 저장
    tx.set(userRef, { displayName: newName }, { merge: true });
  });

  await updateProfile(auth.currentUser, { displayName: newName });
}

// ── 프로필 사진 ──

export async function uploadProfilePhoto(user, blob) {
  // 기존 사진 전부 삭제
  const folder = storageRef(storage, `profile_photos/${user.uid}`);
  try {
    const list = await listAll(folder);
    await Promise.all(list.items.map(item => deleteObject(item)));
  } catch (_) {}

  const photoRef = storageRef(storage, `profile_photos/${user.uid}/photo.jpg`);
  await uploadBytes(photoRef, blob, { contentType: 'image/jpeg' });
  const url = await getDownloadURL(photoRef);
  await updateProfile(auth.currentUser, { photoURL: url });
  await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
  return url;
}

// ── 알림 ──

export async function addNotification(toUid, data) {
  const ref = doc(collection(db, "notifications", toUid, "items"));
  await setDoc(ref, { ...data, read: false, createdAt: serverTimestamp() });
}

export async function markNotificationRead(toUid, notifId) {
  await updateDoc(doc(db, "notifications", toUid, "items", notifId), { read: true });
}

export async function markAllNotificationsRead(toUid) {
  const q = query(collection(db, "notifications", toUid, "items"), orderBy("createdAt", "desc"), limit(50));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.filter(d => !d.data().read).map(d => updateDoc(d.ref, { read: true })));
}

export async function getNotifSettings(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data().notifSettings ?? {}) : {};
}

export async function updateNotifSettings(uid, settings) {
  await setDoc(doc(db, "users", uid), { notifSettings: settings }, { merge: true });
}

// ── 커뮤니티 (게시글 + 댓글) ──

export async function createPost(user, title, content, imageUrls = [], poll = null, postId = null) {
  const ref = doc(db, "posts", postId ?? crypto.randomUUID());
  await setDoc(ref, {
    title, content,
    imageUrls,
    poll, // null 또는 { options: [{text, votes:[]}] }
    authorUid: user.uid,
    authorName: user.displayName ?? '익명',
    authorPhoto: user.photoURL ?? null,
    createdAt: serverTimestamp(),
    commentCount: 0,
  });
  return ref.id;
}

// 투표
export async function votePoll(postId, optionIndex, uid) {
  const ref = doc(db, "posts", postId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const poll = snap.data()?.poll;
    if (!poll) return;
    const options = poll.options.map((opt, i) => {
      if (i !== optionIndex) return opt;
      const votes = opt.votes ?? [];
      // 이미 투표했으면 취소, 아니면 추가
      const newVotes = votes.includes(uid)
        ? votes.filter(v => v !== uid)
        : [...votes, uid];
      return { ...opt, votes: newVotes };
    });
    tx.update(ref, { 'poll.options': options });
  });
}

// 게시글 이미지 업로드
export async function uploadPostImages(postId, files) {
  const urls = [];
  for (const file of files) {
    const ext = file.name.split('.').pop();
    const imgRef = storageRef(storage, `post_images/${postId}/${crypto.randomUUID()}.${ext}`);
    await uploadBytes(imgRef, file, { contentType: file.type });
    urls.push(await getDownloadURL(imgRef));
  }
  return urls;
}

// 분석 이벤트 기록 (최근 1시간 랭킹용)
export async function incrementStockStat(ticker, name) {
  const ref = doc(collection(db, "stockAnalysisLog"));
  await setDoc(ref, { ticker, name, analyzedAt: serverTimestamp() });
}

export async function getPost(postId) {
  const snap = await getDoc(doc(db, "posts", postId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, "posts", postId));
}

export async function addComment(user, postId, content, parentId = null) {
  const colRef = collection(db, "posts", postId, "comments");
  const ref = doc(colRef, crypto.randomUUID());
  await setDoc(ref, {
    content, parentId,
    authorUid: user.uid,
    authorName: user.displayName ?? '익명',
    authorPhoto: user.photoURL ?? null,
    createdAt: serverTimestamp(),
    likes: [],
  });
  try {
    const postSnap = await getDoc(doc(db, "posts", postId));
    const postData = postSnap.data() ?? {};
    await updateDoc(doc(db, "posts", postId), { commentCount: (postData.commentCount ?? 0) + 1 });
    if (parentId) {
      const parentSnap = await getDoc(doc(db, "posts", postId, "comments", parentId));
      const parentData = parentSnap.data() ?? {};
      if (parentData.authorUid && parentData.authorUid !== user.uid) {
        await addNotification(parentData.authorUid, {
          type: 'reply_comment', fromName: user.displayName ?? '누군가',
          postId, postTitle: postData.title ?? '', commentId: parentId,
        });
      }
    } else if (postData.authorUid && postData.authorUid !== user.uid) {
      await addNotification(postData.authorUid, {
        type: 'comment_post', fromName: user.displayName ?? '누군가',
        postId, postTitle: postData.title ?? '',
      });
    }
  } catch (_) {}
}

export async function toggleCommentLike(postId, commentId, user) {
  const uid = user.uid;
  const ref = doc(db, "posts", postId, "comments", commentId);
  const snap = await getDoc(ref);
  const data = snap.data() ?? {};
  const likes = data.likes ?? [];
  const isLiking = !likes.includes(uid);
  const newLikes = isLiking ? [...likes, uid] : likes.filter(id => id !== uid);
  await updateDoc(ref, { likes: newLikes });
  if (isLiking && data.authorUid && data.authorUid !== uid) {
    try {
      const postSnap = await getDoc(doc(db, "posts", postId));
      await addNotification(data.authorUid, {
        type: 'like_comment', fromName: user.displayName ?? '누군가',
        postId, postTitle: postSnap.data()?.title ?? '', commentId,
      });
    } catch (_) {}
  }
  return newLikes;
}

export async function togglePostLike(postId, user) {
  const uid = user.uid;
  const ref = doc(db, "posts", postId);
  const snap = await getDoc(ref);
  const data = snap.data() ?? {};
  const likes = data.likes ?? [];
  const isLiking = !likes.includes(uid);
  const newLikes = isLiking ? [...likes, uid] : likes.filter(id => id !== uid);
  await updateDoc(ref, { likes: newLikes });
  if (isLiking && data.authorUid && data.authorUid !== uid) {
    try {
      await addNotification(data.authorUid, {
        type: 'like_post', fromName: user.displayName ?? '누군가',
        postId, postTitle: data.title ?? '',
      });
    } catch (_) {}
  }
  return newLikes;
}

export async function getComments(postId) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
}

export async function updateComment(postId, commentId, content) {
  await updateDoc(doc(db, "posts", postId, "comments", commentId), { content, editedAt: serverTimestamp() });
}

// ── 관심 종목 ──

export async function getFavorites(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().favorites ?? []) : [];
}

export async function addFavorite(uid, ticker, name) {
  const ref = doc(db, "users", uid);
  await setDoc(ref, { favorites: arrayUnion({ ticker, name }) }, { merge: true });
}

export async function removeFavorite(uid, ticker) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data().favorites ?? [];
  const updated = current.filter(f => f.ticker !== ticker);
  await updateDoc(ref, { favorites: updated });
}

export async function updateFavoritePurchase(uid, ticker, purchasePrice, purchaseCurrency) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data().favorites ?? [];
  const updated = current.map(f =>
    f.ticker === ticker
      ? { ...f, purchasePrice: purchasePrice ?? null, purchaseCurrency: purchaseCurrency ?? null }
      : f
  );
  await updateDoc(ref, { favorites: updated });
}

// ── 최근 분석 기록 ──

export async function saveHistory(uid, ticker, name) {
  // ticker를 문서 ID로 사용 → 같은 종목은 항상 덮어쓰기 (중복 불가)
  const ref = doc(db, "users", uid, "history", ticker.replace(/\./g, "_"));
  await setDoc(ref, { ticker, name, analyzedAt: serverTimestamp() });
}

export async function deleteHistory(uid, ticker) {
  const ref = doc(db, "users", uid, "history", ticker.replace(/\./g, "_"));
  await deleteDoc(ref);
}

export async function getHistory(uid, count = 5) {
  const col = collection(db, "users", uid, "history");
  const q = query(col, orderBy("analyzedAt", "desc"), limit(20));
  const snap = await getDocs(q);
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // ticker 기준 중복 제거 (최신 순 유지)
  const seen = new Set();
  return all.filter(h => {
    if (seen.has(h.ticker)) return false;
    seen.add(h.ticker);
    return true;
  }).slice(0, count);
}
