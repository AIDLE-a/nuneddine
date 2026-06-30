import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, updateProfile } from "firebase/auth";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, arrayRemove,
  collection, addDoc, getDocs, deleteDoc,
  query, orderBy, limit, where, serverTimestamp,
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

export async function uploadProfilePhoto(user, file) {
  const ext = file.name.split('.').pop();
  const photoRef = storageRef(storage, `profile_photos/${user.uid}.${ext}`);
  await uploadBytes(photoRef, file);
  const url = await getDownloadURL(photoRef);
  await updateProfile(auth.currentUser, { photoURL: url });
  await setDoc(doc(db, "users", user.uid), { photoURL: url }, { merge: true });
  return url;
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
