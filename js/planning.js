import { h, toast, statCard } from './ui.js';
import {
  todayKey, weekRange, monthRange, weekdayKeys, sessionsInRange, sumMinutes, formatDuration, formatPercent, goalCompliance,
  parseHours, parseCount, parsePlan, plannedDayMinutes, plannedByDiscipline, minutesByKey, DAY_NAMES, formatDateBR
} from './calculations.js';
import { buildRecommendations, DEDICATION_WINDOW_DAYS, OLD_MISTAKE_DAYS } from './recommendations.js';
import { barsHorizontal } from './charts.js';
import { discOptions } from './forms.js';
import { saveGoals, savePlan } from './storage.js';

const ddmm = key => formatDateBR(key).slice(0, 5);
const hoursValue = min => (min ? String(+(min / 60).toFixed(2)) : '');
const bar = pct => h('div', { class: 'bar', role: 'presentation' }, h('i', { style: `width:${Math.min(100, pct ?? 0)}%` }));

function goalCard(label, real, goal, fmt) {
  const pct = goalCompliance(real, goal);
  return h('div', { class: 'card' },
    h('div', { class: 'label' }, label), h('div', { class: 'value' }, formatPercent(pct)),
    h('div', { class: 'sub' }, `${fmt(real)} de ${fmt(goal)}`), bar(pct));
}

// ---------------------------------------------------------------- Metas
function renderGoals(root, ctx) {
  const discs = ctx.edital.disciplines;
  const today = todayKey();
  const g = ctx.goals || {};
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
  // num() devolve o campo (el) e a caixa com rótulo (box): o formulário lê sempre o campo.
  const num = (id, label, value, props = {}) => {
    const el = h('input', { id, type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value, ...props });
    return { el, box: h('div', {}, h('label', { for: id }, label), el) };
  };
  const wh = num('g-wh', 'Horas por semana', hoursValue(g.weeklyMinutes));
  const mh = num('g-mh', 'Horas por mês', hoursValue(g.monthlyMinutes));
  const wq = num('g-wq', 'Questões por semana', g.weeklyQuestions ?? '', { step: '1' });
  const mq = num('g-mq', 'Questões por mês', g.monthlyQuestions ?? '', { step: '1' });
  const per = discs.map(d => [d, h('input', { id: `g-d-${d.id}`, type: 'number', inputmode: 'decimal', min: '0', step: '0.5', value: hoursValue(g.perDiscipline?.[d.id]) })]);
  const progress = h('div');

  function drawProgress() {
    const goals = ctx.goals || {};
    const [wFrom, wTo] = weekRange(today);
    const [mFrom] = monthRange(today);
    const weekS = sessionsInRange(ctx.sessions, wFrom, wTo);
    const monthS = sessionsInRange(ctx.sessions, mFrom, today);
    const qSum = (from, to) => sessionsInRange(ctx.questions, from, to).reduce((n, q) => n + (q.total || 0), 0);
    const cards = [
      goals.weeklyMinutes && goalCard('Meta semanal de horas', sumMinutes(weekS), goals.weeklyMinutes, formatDuration),
      goals.monthlyMinutes && goalCard('Meta mensal de horas (mês até hoje)', sumMinutes(monthS), goals.monthlyMinutes, formatDuration),
      goals.weeklyQuestions && goalCard('Meta semanal de questões', qSum(wFrom, wTo), goals.weeklyQuestions, String),
      goals.monthlyQuestions && goalCard('Meta mensal de questões (mês até hoje)', qSum(mFrom, today), goals.monthlyQuestions, String)
    ].filter(Boolean);
    const perGoals = discs.filter(d => goals.perDiscipline?.[d.id]);
    const minBy = minutesByKey(weekS, s => s.disciplineId);
    progress.replaceChildren(...[
      h('h2', {}, 'Cumprimento das metas'),
      cards.length ? h('div', { class: 'grid' }, cards) : h('div', { class: 'empty' }, 'Nenhuma meta definida. Preencha acima para acompanhar o cumprimento.'),
      perGoals.length ? h('div', { class: 'card section-tight' }, h('h3', {}, 'Metas por disciplina (semana atual)'),
        barsHorizontal(perGoals.map(d => {
          const real = minBy.get(d.id) || 0; const goal = goals.perDiscipline[d.id];
          return { label: d.name, bars: [{ pct: Math.min(100, goalCompliance(real, goal)), text: `${formatDuration(real)} de ${formatDuration(goal)} (${formatPercent(goalCompliance(real, goal))})` }] };
        }))) : null,
      h('p', { class: 'muted note' }, 'O cumprimento não é limitado a 100%: passar da meta aparece como mais de 100%.')
    ].filter(Boolean));
  }

  const form = h('form', { novalidate: true, onsubmit: async e => {
    e.preventDefault();
    err.hidden = true;
    try {
      const goals = {};
      const set = (k, v) => { if (v != null) goals[k] = v; };
      set('weeklyMinutes', parseHours(wh.el.value, 168));
      set('monthlyMinutes', parseHours(mh.el.value, 744));
      set('weeklyQuestions', parseCount(wq.el.value, 5000));
      set('monthlyQuestions', parseCount(mq.el.value, 20000));
      const perDiscipline = {};
      for (const [d, el] of per) {
        try { const m = parseHours(el.value, 168); if (m != null) perDiscipline[d.id] = m; }
        catch (ex) { throw new Error(`${d.name}: ${ex.message}`); }
      }
      if (Object.keys(perDiscipline).length) goals.perDiscipline = perDiscipline;
      await saveGoals(ctx.user.uid, goals);
      ctx.goals = goals;
      toast('Metas salvas');
      drawProgress();
    } catch (ex) {
      err.textContent = ex.code ? 'Não foi possível salvar. Verifique a conexão e as regras do Firestore.' : ex.message;
      err.hidden = false;
      if (ex.code) console.error(ex);
    }
  } },
    h('div', { class: 'form-grid' }, wh.box, mh.box, wq.box, mq.box),
    h('details', { class: 'sim-details' }, h('summary', {}, 'Metas semanais por disciplina (horas)'),
      h('div', { class: 'form-grid' }, per.map(([d, el]) => h('div', {}, h('label', { for: `g-d-${d.id}` }, d.name), el)))),
    err,
    h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn primary' }, 'Salvar metas')),
    h('p', { class: 'muted note' }, 'Deixe em branco o que não quiser como meta. Para remover uma meta, apague o valor e salve.'));

  root.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Minhas metas'), form), h('div', { class: 'section' }, progress));
  drawProgress();
}

// ---------------------------------------------------------------- Semana
function renderWeek(root, ctx) {
  const discs = ctx.edital.disciplines;
  const today = todayKey();
  const [wStart] = weekRange(today);
  const keys = weekdayKeys(wStart);
  const days = ctx.plan?.days ?? {};
  const minByDay = minutesByKey(ctx.sessions.filter(s => keys.includes(s.date)), s => s.date);
  const discName = id => discs.find(d => d.id === id)?.name ?? id;

  // ---- planejado x realizado ----
  const rows = keys.map((key, i) => {
    const planned = plannedDayMinutes(days[i]);
    const real = minByDay.get(key) || 0;
    const future = key > today;
    const pct = goalCompliance(real, planned);
    return { key, i, planned, real, future, pct };
  });
  const plannedWeek = rows.reduce((n, r) => n + r.planned, 0);
  const realWeek = rows.reduce((n, r) => n + r.real, 0);
  const plannedSoFar = rows.filter(r => !r.future).reduce((n, r) => n + r.planned, 0);
  const pctWeek = goalCompliance(realWeek, plannedWeek);
  const pctSoFar = goalCompliance(realWeek, plannedSoFar);

  const dayList = h('ul', { class: 'sessions' }, rows.map(r => h('li', { class: 'session' },
    h('div', { class: 'session-main' },
      h('div', { class: 'session-top' }, h('strong', {}, `${DAY_NAMES[r.i]} ${ddmm(r.key)}`), r.key === today ? h('span', { class: 'chip done' }, 'Hoje') : null),
      h('div', {}, r.future
        ? `Planejado: ${r.planned ? formatDuration(r.planned) : 'nada'} | Ainda não chegou`
        : `Planejado: ${r.planned ? formatDuration(r.planned) : 'nada'} | Realizado: ${r.real ? formatDuration(r.real) : '0min'} | Cumprimento: ${r.planned ? formatPercent(r.pct) : 'Sem plano'}`),
      r.planned && !r.future ? bar(r.pct) : null))));

  const plannedDisc = plannedByDiscipline(days);
  const realDisc = minutesByKey(ctx.sessions.filter(s => keys.includes(s.date)), s => s.disciplineId);
  const discRows = discs.filter(d => plannedDisc.get(d.id) || realDisc.get(d.id)).map(d => {
    const p = plannedDisc.get(d.id) || 0; const r = realDisc.get(d.id) || 0;
    return { label: d.name, bars: [{ pct: p ? Math.min(100, goalCompliance(r, p)) : null, text: p ? `${formatDuration(r)} de ${formatDuration(p)} (${formatPercent(goalCompliance(r, p))})` : `${formatDuration(r)} (sem plano)` }] };
  });

  // ---- editor do plano ----
  const draft = DAY_NAMES.map((_, i) => (days[i] || []).map(b => ({ disciplineId: b.disciplineId, minutes: String(b.minutes) })));
  const editor = h('div');
  const err = h('p', { class: 'form-error', role: 'alert', hidden: true });

  function drawEditor() {
    editor.replaceChildren(...draft.map((blocks, i) => h('div', { class: 'card plan-day' },
      h('h3', {}, DAY_NAMES[i]),
      ...blocks.map((b, j) => h('div', { class: 'plan-row' },
        h('select', { 'aria-label': `${DAY_NAMES[i]}, bloco ${j + 1}: disciplina`, onchange: e => { b.disciplineId = e.target.value; } }, discOptions(discs, b.disciplineId, ['', 'Disciplina'])),
        h('input', { type: 'number', min: '5', step: '5', inputmode: 'numeric', placeholder: 'min', 'aria-label': `${DAY_NAMES[i]}, bloco ${j + 1}: minutos`, value: b.minutes, oninput: e => { b.minutes = e.target.value; } }),
        h('button', { type: 'button', class: 'btn ghost danger', 'aria-label': `Remover bloco ${j + 1} de ${DAY_NAMES[i]}`, onclick: () => { blocks.splice(j, 1); drawEditor(); } }, 'Remover'))),
      h('button', { type: 'button', class: 'btn ghost', onclick: () => { blocks.push({ disciplineId: '', minutes: '' }); drawEditor(); } }, 'Adicionar bloco'))));
  }

  const saveBtn = h('button', { type: 'button', class: 'btn primary', onclick: async () => {
    err.hidden = true;
    try {
      const plan = { days: parsePlan(draft) };
      saveBtn.disabled = true;
      await savePlan(ctx.user.uid, plan);
      ctx.plan = plan;
      toast('Plano salvo');
      renderWeek(root, ctx);
    } catch (ex) {
      err.textContent = ex.code ? 'Não foi possível salvar. Verifique a conexão e as regras do Firestore.' : ex.message;
      err.hidden = false;
      saveBtn.disabled = false;
      if (ex.code) console.error(ex);
    }
  } }, 'Salvar plano');

  root.replaceChildren(
    h('div', { class: 'section-tight' }, h('h2', {}, `Semana atual (${ddmm(keys[0])} a ${ddmm(keys[6])})`)),
    h('div', { class: 'grid' },
      statCard('Planejado na semana', plannedWeek ? formatDuration(plannedWeek) : 'Sem dados', plannedWeek ? null : 'Monte o plano abaixo'),
      statCard('Realizado na semana', formatDuration(realWeek)),
      statCard('Cumprimento da semana', formatPercent(pctWeek), plannedWeek ? `${formatDuration(realWeek)} de ${formatDuration(plannedWeek)}` : null),
      statCard('Cumprimento até hoje', formatPercent(pctSoFar), plannedSoFar ? `Planejado até hoje: ${formatDuration(plannedSoFar)}` : null)),
    h('div', { class: 'section-tight' }, dayList),
    discRows.length ? h('div', { class: 'card section-tight' }, h('h3', {}, 'Por disciplina (semana atual)'), barsHorizontal(discRows)) : null,
    h('div', { class: 'section' }, h('h2', {}, 'Plano semanal'),
      h('p', { class: 'muted note' }, 'O plano vale para todas as semanas. Adicione blocos de estudo (disciplina e minutos) em cada dia.'),
      editor, err, h('div', { class: 'form-actions' }, saveBtn)));
  drawEditor();
}

// ---------------------------------------------------------------- Recomendações
export function renderRecommendationsList(recs, limit) {
  const shown = limit ? recs.slice(0, limit) : recs;
  return h('ol', { class: 'recs' }, shown.map(r => h('li', { class: 'rec' },
    h('strong', {}, r.title),
    h('p', { class: 'muted' }, `Por quê: ${r.reason}`),
    h('a', { href: r.link }, 'Abrir'))));
}

function renderRecs(root, ctx) {
  const recs = buildRecommendations({
    discs: ctx.edital.disciplines, progress: ctx.progress, sessions: ctx.sessions, questions: ctx.questions,
    flashcards: ctx.flashcards, mistakes: ctx.mistakes, goals: ctx.goals || {}, today: todayKey()
  });
  root.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, 'O que priorizar'),
      recs.length
        ? h('div', {}, h('p', {}, h('strong', {}, `Para a próxima sessão, comece por: ${recs[0].title}.`)), renderRecommendationsList(recs))
        : h('div', { class: 'empty' }, 'Sem sugestões por enquanto. Elas aparecem conforme você registra estudos, questões, revisões e metas.')),
    h('details', { class: 'card method section-tight' }, h('summary', {}, 'Como as sugestões são geradas'),
      h('ul', { class: 'plain-list' }, [
        'Ordem de prioridade: revisões pendentes, aproveitamento baixo, metas não cumpridas, pouca dedicação, teoria sem exercícios e assuntos novos.',
        `Revisões: flashcards que vencem hoje ou estão atrasados, e erros do caderno sem revisão há ${OLD_MISTAKE_DAYS} dias ou mais.`,
        'Aproveitamento baixo: só com 20 questões ou mais na disciplina e taxa abaixo de 60%. Com menos questões, não há conclusão.',
        'Metas não cumpridas: olha a última semana completa (segunda a domingo) e só cobra se você já tinha histórico antes dela.',
        `Pouca dedicação: compara a fatia da nota de cada disciplina (Gerais pesa 1 e Específicos pesa 2) com a fatia do seu tempo nos últimos ${DEDICATION_WINDOW_DAYS} dias, quando há pelo menos 5 horas registradas.`,
        'Teoria sem exercícios: assuntos com teoria concluída e exercícios não iniciados. Assuntos novos: mostra as 3 disciplinas com mais peso ainda não estudado.',
        'São sugestões baseadas nos seus registros, não previsões de resultado.'
      ].map(t => h('li', {}, t)))));
}

// ---------------------------------------------------------------- Página
const TABS = [['recomendacoes', 'Recomendações', renderRecs], ['metas', 'Metas', renderGoals], ['semana', 'Semana', renderWeek]];
let tab = null;

export function renderPlanning(root, ctx, sub) {
  if (TABS.some(t => t[0] === sub)) tab = sub;
  else if (!tab) tab = Object.keys(ctx.goals || {}).length || Object.keys(ctx.plan?.days || {}).length ? 'recomendacoes' : 'metas';
  const content = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const show = id => {
    tab = id;
    tabs.replaceChildren(...TABS.map(([k, label]) =>
      h('button', { type: 'button', role: 'tab', class: k === tab ? 'tab active' : 'tab', 'aria-selected': k === tab ? 'true' : 'false', onclick: () => show(k) }, label)));
    TABS.find(t => t[0] === tab)[2](content, ctx);
  };
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Planejamento'), h('p', {}, 'Defina metas, organize a semana e veja o que priorizar.')),
    tabs, content);
  show(tab);
}
