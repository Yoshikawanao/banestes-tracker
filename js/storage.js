// Única camada que fala com o Firestore. Dados ficam em users/{uid}/...
import { db, collection, doc, getDocs, setDoc, serverTimestamp } from './firebase.js';

export async function loadEditalProgress(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'edital_progress'));
  const map = {};
  snap.forEach(d => { map[d.id] = d.data(); });
  return map;
}

export function saveEditalProgress(uid, topicId, patch) {
  return setDoc(
    doc(db, 'users', uid, 'edital_progress', topicId),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true }
  );
}
