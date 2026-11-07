import { h, statCard } from './ui.js';
import {
  coverage, formatPercent, sumMinutes, distinctDays, formatDuration, weekRange, monthRange, todayKey,
  sessionsInRange, summarizeQuestions, averagePerStudyDay, lastNWeeks, minutesByKey, weeklyHitRates, formatDateBR, simulationScores, formatGrade, cardStatus
} from './calculations.js';
import { barsVertical, barsHorizontal, stacked } from './charts.js';
import { renderCalendar } from './calendar.js';
import { actLabel } from './constants.js';

const chartCard = (title, content, note) =>
  h('div', { class: 'card chart-card' }, h('h3', {}, title), content, note && h('p', { class: 'muted chart-note' }, note));
const noData = text => h('p', { class: 'muted' }, text);
const ddmm = key => formatDateBR(key).slice(0, 5);

export function renderDashboard(root, ctx) {
  const discs = ctx.edital.disciplines;
  const topics = discs.flatMap(d => d.topics);
  const today = todayKey();
  const sessions = ctx.sessions;
  const has = sessions.length > 0;

  const t = coverage(topics, ctx.progress, 'theory', 'concluido');
  const e = coverage(topics, ctx.progress, 'exercises', 'concluido');
  const r = coverage(topics, ctx.progress, 'revision', 'feita');
  const q = summarizeQuestions(ctx.questions);
  const sub = c => (c.total ? `${c.done} de ${c.total} assuntos` : 'Edital sem assuntos');
  const [wFrom, wTo] = weekRange(today);
  const [mFrom, mTo] = monthRange(today);
  const avg = averagePerStudyDay(sessions);
  const lastSim = [...(ctx.simulations || [])]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
    .map(s => ({ s, sc: simulationScores(s.results, discs, s.type) })).find(x => x.sc.final != null);

  // ---- gráficos ----
  const weeks = lastNWeeks(today, 8);
  const weekMin = weeks.map(([a, b]) => sumMinutes(sessionsInRange(sessions, a, b)));
  const hoursChart = has
    ? barsVertical(weeks.map(([a], i) => ({ label: ddmm(a), value: weekMin[i], text: weekMin[i] ? formatDuration(weekMin[i]) : '-' })))
    : noData('Sem dados. Registre sessões em Estudos.');

  const byDisc = [...minutesByKey(sessions, s => s.disciplineId).entries()].sort((a, b) => b[1] - a[1]);
  const totalMin = sumMinutes(sessions);
  const discChart = byDisc.length
    ? barsHorizontal(byDisc.map(([id, min]) => ({
        label: discs.find(d => d.id === id)?.name ?? id,
        bars: [{ pct: (min / byDisc[0][1]) * 100, text: `${formatDuration(min)} (${formatPercent((min / totalMin) * 100)})` }]
      })))
    : noData('Sem dados.');

  const blockMin = { gerais: 0, especificos: 0 };
  for (const [id, min] of byDisc) { const b = discs.find(d => d.id === id)?.block; if (b in blockMin) blockMin[b] += min; }
  const blockSum = blockMin.gerais + blockMin.especificos;
  const blockChart = blockSum
    ? stacked([
        { label: 'Conhecimentos Gerais', value: blockMin.gerais, text: `${formatDuration(blockMin.gerais)} (${formatPercent((blockMin.gerais / blockSum) * 100)})` },
        { label: 'Conhecimentos Específicos', value: blockMin.especificos, text: `${formatDuration(blockMin.especificos)} (${formatPercent((blockMin.especificos / blockSum) * 100)})` }])
    : noData('Sem dados.');

  const progChart = barsHorizontal(discs.map(d => {
    const th = coverage(d.topics, ctx.progress, 'theory', 'concluido');
    const ex = coverage(d.topics, ctx.progress, 'exercises', 'concluido');
    const txt = c => (c.total ? `${formatPercent(c.percent)} (${c.done}/${c.total})` : 'Sem dados');
    return { label: d.name, bars: [{ name: 'Teoria', pct: th.percent, text: txt(th) }, { name: 'Exercícios', pct: ex.percent, text: txt(ex) }] };
  }));

  const rates = weeklyHitRates(ctx.questions, weeks);
  const rateChart = q.total
    ? barsVertical(rates.map(w => ({
        label: ddmm(w.from), sub: w.total ? `n=${w.total}` : null, value: w.rate,
        text: w.total ? formatPercent(w.rate) : '-'
      })), 100)
    : noData('Sem dados. Registre questões em Desempenho.');

  // ---- sessões recentes ----
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0)).slice(0, 5);
  const recentList = recent.length
    ? h('ul', { class: 'sessions' }, recent.map(s => h('li', { class: 'session' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' }, h('strong', {}, formatDateBR(s.date)), h('span', { class: 'chip' }, actLabel(s.activity)), h('span', { class: 'session-dur' }, formatDuration(s.minutes))),
          h('div', {}, discs.find(d => d.id === s.disciplineId)?.name ?? s.disciplineId)))))
    : h('div', { class: 'empty' }, 'Nenhuma sessão registrada ainda.');

  const cards = ctx.flashcards || [];
  const mistakes = ctx.mistakes || [];
  const dueCards = cards.filter(c => cardStatus(c, today) === 'pendente').length;
  const pendingMistakes = mistakes.filter(m => m.status === 'pendente').length;
  const calBox = h('div', { class: 'card' });

  root.replaceChildren(...[
    h('div', { class: 'page-head' }, h('h1', {}, 'Início'), h('p', {}, 'Resumo da preparação. Só aparecem números reais.')),
    ctx.timer && h('a', { class: 'notice', href: '#/estudos' }, ctx.timer.status === 'running' ? '● Sessão em andamento. Toque para abrir o cronômetro.' : '❚❚ Sessão pausada. Toque para abrir o cronômetro.'),
    h('div', { class: 'grid' },
      statCard('Horas na semana', has ? formatDuration(sumMinutes(sessionsInRange(sessions, wFrom, wTo))) : 'Sem dados', has ? 'Segunda a domingo' : null),
      statCard('Horas no mês', has ? formatDuration(sumMinutes(sessionsInRange(sessions, mFrom, mTo))) : 'Sem dados'),
      statCard('Horas acumuladas', has ? formatDuration(sumMinutes(sessions)) : 'Sem dados'),
      statCard('Dias estudados', has ? String(distinctDays(sessions)) : 'Sem dados'),
      statCard('Média por dia estudado', avg == null ? 'Sem dados' : formatDuration(Math.round(avg)), avg == null ? null : 'Total dividido pelos dias com estudo'),
      statCard('Meta semanal', 'Sem dados', 'Definida em Planejamento (Etapa 10)'),
      statCard('Teoria concluída', formatPercent(t.percent), sub(t)),
      statCard('Exercícios concluídos', formatPercent(e.percent), sub(e)),
      statCard('Revisões feitas', formatPercent(r.percent), sub(r)),
      statCard('Última nota estimada', lastSim ? formatGrade(lastSim.sc.final) : 'Sem dados',
        lastSim ? `${lastSim.s.name}, ${formatDateBR(lastSim.s.date)}${lastSim.sc.estimated ? ' (estimativa parcial)' : ''}` : 'Registre um simulado em Desempenho'),
      statCard('Taxa de acertos', formatPercent(q.rate), q.total ? `${q.correct} de ${q.total} questões` : 'Registre questões em Desempenho')),

    h('div', { class: 'section' }, h('h2', {}, 'Gráficos'),
      h('div', { class: 'chart-grid' },
        chartCard('Horas por semana (8 semanas)', hoursChart, 'Cada coluna é uma semana (segunda a domingo), identificada pelo dia de início.'),
        chartCard('Aproveitamento por semana', rateChart, 'n é o número de questões da semana. Semanas com poucas questões dizem pouco.'),
        chartCard('Tempo por disciplina', discChart),
        chartCard('Gerais x Específicos', blockChart, 'Distribuição do tempo estudado entre os dois blocos.'),
        chartCard('Progresso do edital', progChart, 'Conta apenas assuntos concluídos. Teoria concluída não significa domínio.'))),

    h('div', { class: 'section' }, h('h2', {}, 'Calendário de consistência'), calBox),
    h('div', { class: 'section' }, h('h2', {}, 'Sessões recentes'), recentList,
      has ? h('p', {}, h('a', { href: '#/estudos' }, 'Ver todo o histórico')) : null),
    h('div', { class: 'section' }, h('h2', {}, 'Revisões pendentes'),
      h('div', { class: 'grid' },
        statCard('Flashcards para revisar', cards.length ? String(dueCards) : 'Sem dados', cards.length ? 'Vencem hoje ou estão atrasados' : 'Crie cartões em Revisões'),
        statCard('Erros a revisar', mistakes.length ? String(pendingMistakes) : 'Sem dados', mistakes.length ? 'No caderno de erros' : 'Registre erros em Revisões')),
      (dueCards || pendingMistakes) ? h('p', {}, h('a', { href: '#/revisoes' }, 'Abrir revisões')) : null,
      h('div', { class: 'empty' }, 'Sugestões de estudo com justificativa chegam na Etapa 10.'))
  ].filter(Boolean));
  renderCalendar(calBox, ctx);
}
