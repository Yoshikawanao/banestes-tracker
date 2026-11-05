import { h } from './ui.js';
import { coverage, formatPercent } from './calculations.js';

function card(label, value, sub) {
  return h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), sub && h('div', { class: 'sub' }, sub));
}

export function renderDashboard(root, ctx) {
  const topics = ctx.edital.disciplines.flatMap(d => d.topics);
  const t = coverage(topics, ctx.progress, 'theory', 'concluido');
  const e = coverage(topics, ctx.progress, 'exercises', 'concluido');
  const r = coverage(topics, ctx.progress, 'revision', 'feita');
  const sub = c => (c.total ? `${c.done} de ${c.total} assuntos` : 'Edital ainda sem assuntos importados');
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Início'), h('p', {}, 'Resumo da preparação. Só aparecem números reais.')),
    h('div', { class: 'grid' },
      card('Teoria concluída', formatPercent(t.percent), sub(t)),
      card('Exercícios concluídos', formatPercent(e.percent), sub(e)),
      card('Revisões feitas', formatPercent(r.percent), sub(r)),
      card('Horas na semana', 'Sem dados', 'Disponível com as sessões de estudo'),
      card('Taxa de acertos', 'Sem dados', 'Disponível com o registro de questões')),
    h('div', { class: 'section' }, h('div', { class: 'empty' }, 'Sessões recentes, revisões pendentes e sugestões vão aparecer aqui nas próximas etapas.')));
}
