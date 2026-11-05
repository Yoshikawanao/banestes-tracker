import { h, toast } from './ui.js';
import {
  configured, auth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from './firebase.js';
import { loadEditalProgress, loadSessions, loadTimer } from './storage.js';
import { renderDashboard } from './dashboard.js';
import { renderEdital } from './edital.js';
import { renderSessions } from './sessions.js';
import { stopTick } from './timer.js';

const $ = id => document.getElementById(id);
const ctx = { user: null, edital: null, progress: {}, sessions: [], timer: null };

const PLACEHOLDERS = {
  desempenho: ['Desempenho', 'Questões, gráficos e simulados chegam nas Etapas 5, 7 e 8.'],
  revisoes: ['Revisões', 'Caderno de erros e flashcards chegam na Etapa 9.'],
  planejamento: ['Planejamento', 'Metas e recomendações chegam na Etapa 10.']
};

const ERRORS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com a internet.'
};

function route() {
  stopTick();
  const name = (location.hash.replace(/^#\//, '') || 'dashboard').split('/')[0];
  const view = $('view');
  document.querySelectorAll('#nav a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (name === 'edital') renderEdital(view, ctx);
  else if (name === 'estudos') renderSessions(view, ctx);
  else if (PLACEHOLDERS[name]) {
    const [title, text] = PLACEHOLDERS[name];
    view.replaceChildren(h('div', { class: 'page-head' }, h('h1', {}, title)), h('div', { class: 'empty' }, text));
  } else renderDashboard(view, ctx);
  window.scrollTo(0, 0);
}

async function enter(user) {
  ctx.user = user;
  $('user-email').textContent = user.email;
  try {
    ctx.edital = await (await fetch('data/edital.json', { cache: 'no-cache' })).json();
    ctx.progress = await loadEditalProgress(user.uid);
    ctx.sessions = await loadSessions(user.uid);
    ctx.timer = await loadTimer(user.uid);
  } catch (e) {
    console.error(e);
    toast('Erro ao carregar os dados. Verifique as regras do Firestore.', 'error');
    ctx.edital = ctx.edital || { disciplines: [], meta: { retificacoes: [] } };
  }
  $('login').hidden = true;
  $('app').hidden = false;
  route();
}

function showLogin(message) {
  ctx.user = null;
  $('app').hidden = true;
  $('login').hidden = false;
  const err = $('login-error');
  err.hidden = !message;
  err.textContent = message || '';
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('login-btn');
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
  } catch (err) {
    showLogin(ERRORS[err.code] || 'Não foi possível entrar. Tente novamente.');
  } finally {
    btn.disabled = false;
  }
});

const logout = () => signOut(auth);
$('logout').addEventListener('click', logout);
$('logout-m').addEventListener('click', logout);
window.addEventListener('hashchange', () => { if (ctx.user) route(); });

if (!configured) {
  $('loading').hidden = true;
  showLogin('Firebase não configurado: preencha js/firebase-config.js (veja o README).');
} else {
  onAuthStateChanged(auth, async user => {
    $('loading').hidden = true;
    if (user) await enter(user); else showLogin();
  });
}
