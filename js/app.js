import { h, toast } from './ui.js';
import {
  configured, auth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from './firebase.js';
import { loadEditalProgress, loadSessions, loadTimer, loadQuestions, loadSimulations, loadMistakes, loadFlashcards, loadGoals, loadPlan } from './storage.js';
import { renderDashboard } from './dashboard.js';
import { renderEdital } from './edital.js';
import { renderSessions } from './sessions.js';
import { renderPerformance } from './performance.js';
import { renderReviews } from './reviews.js';
import { renderPlanning } from './planning.js';
import { stopTick } from './timer.js';

const $ = id => document.getElementById(id);
const ctx = { user: null, edital: null, progress: {}, sessions: [], timer: null, questions: [], simulations: [], mistakes: [], flashcards: [], goals: {}, plan: { days: {} } };

const ERRORS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com a internet.'
};

function route() {
  stopTick();
  const [name, sub] = (location.hash.replace(/^#\//, '') || 'dashboard').split('/');
  const view = $('view');
  document.querySelectorAll('#nav a').forEach(a => {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (name === 'edital') renderEdital(view, ctx);
  else if (name === 'estudos') renderSessions(view, ctx);
  else if (name === 'desempenho') renderPerformance(view, ctx);
  else if (name === 'revisoes') renderReviews(view, ctx);
  else if (name === 'planejamento') renderPlanning(view, ctx, sub);
  else renderDashboard(view, ctx);
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
    ctx.questions = await loadQuestions(user.uid);
    ctx.simulations = await loadSimulations(user.uid);
    ctx.mistakes = await loadMistakes(user.uid);
    ctx.flashcards = await loadFlashcards(user.uid);
    ctx.goals = await loadGoals(user.uid);
    ctx.plan = await loadPlan(user.uid);
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
