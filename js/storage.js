// Única camada que fala com o Firestore. Dados ficam em users/{uid}/...
import { db, collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp } from './firebase.js';

// ---- Edital: progresso por assunto ----
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

// ---- Sessões de estudo ----
export async function loadSessions(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'sessions'));
  return snap.docs.map(d => {
    const { updatedAt, ...data } = d.data();
    return { id: d.id, ...data };
  });
}

// Cria (sem id) ou atualiza (com id). Retorna o id.
export async function saveSession(uid, session) {
  const { id, ...data } = session;
  const ref = id ? doc(db, 'users', uid, 'sessions', id) : doc(collection(db, 'users', uid, 'sessions'));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return ref.id;
}

export function deleteSession(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'sessions', id));
}
