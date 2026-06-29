import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
  arrayUnion, arrayRemove,
  collection, addDoc, getDocs,
  query, orderBy, limit, serverTimestamp,
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
  const col = collection(db, "users", uid, "history");
  await addDoc(col, { ticker, name, analyzedAt: serverTimestamp() });
}

export async function getHistory(uid, count = 5) {
  const col = collection(db, "users", uid, "history");
  const q = query(col, orderBy("analyzedAt", "desc"), limit(count));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
