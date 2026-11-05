import { h, statCard } from './ui.js';
import { coverage, formatPercent, sumMinutes, distinctDays, formatDuration, weekRange, todayKey, sessionsInRange } from './calculations.js';

export function renderDashboard(root, ctx) {
  const topics = ctx.edital.disciplines.flatMap(d => d.topics);
  const t = coverage(topics, ctx.progress, 'theory', 'concluido');
  const e = coverage(topics, ctx.progress, 'exercises', 'concluido');
  const r = coverage(topics, ctx.progress, 'revision', 'feita');
  const sub = c => (c.total ? `${c.done} de ${c.total} assuntos` : 'Edital ainda sem assuntos importados');

  const has = ctx.sessions.length > 0;
  const [from, to] = weekRange(todayKey());
  const week = sessionsInRange(ctx.sessions, from, to);

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Início'), h('p', {}, 'Resumo da preparação. Só aparecem números reais.')),
    h('div', { class: 'grid' },
      statCard('Teoria concluída', formatPercent(t.percent), sub(t)),
      statCard('Exercícios concluídos', formatPercent(e.percent), sub(e)),
      statCard('Revisões feitas', formatPercent(r.percent), sub(r)),
      statCard('Horas na semana', has ? formatDuration(sumMinutes(week)) : 'Sem dados', has ? 'Segunda a domingo' : 'Registre uma sessão em Estudos'),
      statCard('Horas acumuladas', has ? formatDuration(sumMinutes(ctx.sessions)) : 'Sem dados'),
      statCard('Dias estudados', has ? String(distinctDays(ctx.sessions)) : 'Sem dados'),
      statCard('Taxa de acertos', 'Sem dados', 'Disponível com o registro de questões')),
    h('div', { class: 'section' }, h('div', { class: 'empty' }, 'Gráficos, sessões recentes, revisões pendentes e sugestões vão aparecer aqui nas próximas etapas.')));
}
