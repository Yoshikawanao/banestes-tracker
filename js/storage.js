// Única camada que fala com o Firestore. Dados ficam em users/{uid}/...
import { db, collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from './firebase.js';

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

// ---- Cronômetro: uma única sessão ativa por usuário (vale para todos os dispositivos) ----
const timerRef = uid => doc(db, 'users', uid, 'timer', 'active');

export async function loadTimer(uid) {
  const snap = await getDoc(timerRef(uid));
  return snap.exists() ? snap.data() : null;
}

export const saveTimer = (uid, timer) => setDoc(timerRef(uid), timer);
export const clearTimer = uid => deleteDoc(timerRef(uid));

// ---- Questões resolvidas ----
export async function loadQuestions(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'questions'));
  return snap.docs.map(d => {
    const { updatedAt, ...data } = d.data();
    return { id: d.id, ...data };
  });
}

// Cria (sem id) ou atualiza (com id). Retorna o id.
export async function saveQuestion(uid, record) {
  const { id, ...data } = record;
  const ref = id ? doc(db, 'users', uid, 'questions', id) : doc(collection(db, 'users', uid, 'questions'));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: true });
  return ref.id;
}

export const deleteQuestion = (uid, id) => deleteDoc(doc(db, 'users', uid, 'questions', id));

// ---- Simulados ----
export async function loadSimulations(uid) {
  const snap = await getDocs(collection(db, 'users', uid, 'simulations'));
  return snap.docs.map(d => {
    const { updatedAt, ...data } = d.data();
    return { id: d.id, ...data };
  });
}

// Cria (sem id) ou atualiza (com id). Retorna o id. set sem merge: os resultados são substituídos por inteiro.
export async function saveSimulation(uid, sim) {
  const { id, ...data } = sim;
  const ref = id ? doc(db, 'users', uid, 'simulations', id) : doc(collection(db, 'users', uid, 'simulations'));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
  return ref.id;
}

export const deleteSimulation = (uid, id) => deleteDoc(doc(db, 'users', uid, 'simulations', id));
