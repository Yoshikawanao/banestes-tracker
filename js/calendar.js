import { h } from './ui.js';
import {
  monthMatrix, shiftMonth, minutesByDay, intensityLevel, formatDuration, formatDateBR, todayKey, sumMinutes
} from './calculations.js';
import { actLabel } from './constants.js';

const WEEKDAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const LEGEND = [[0, 'Sem estudo'], [1, 'Até 29min'], [2, '30 a 59min'], [3, '1h a 1h59'], [4, '2h ou mais']];

export function renderCalendar(box, ctx) {
  const today = todayKey();
  const [ty, tm] = today.split('-').map(Number);
  const state = { year: ty, month0: tm - 1, selected: today };
  const byDay = minutesByDay(ctx.sessions);
  const discName = id => ctx.edital.disciplines.find(d => d.id === id)?.name ?? id;

  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const gridEl = h('div', { class: 'cal-grid' });
  const titleEl = h('strong', { class: 'cal-title' });
  const dayBox = h('div', { class: 'cal-day-box' });
  const prev = h('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Mês anterior', onclick: () => go(-1) }, '‹');
  const next = h('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Próximo mês', onclick: () => go(1) }, '›');

  function go(delta) {
    const m = shiftMonth(state.year, state.month0, delta);
    state.year = m.year; state.month0 = m.month0;
    draw();
  }

  function drawDay() {
    const rows = ctx.sessions.filter(s => s.date === state.selected)
      .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
    dayBox.replaceChildren(...[
      h('h3', {}, `Sessões de ${formatDateBR(state.selected)}`),
      rows.length
        ? h('p', { class: 'muted' }, `${rows.length} sessão(ões), ${formatDuration(sumMinutes(rows))} no total.`)
        : h('p', { class: 'muted' }, 'Nenhuma sessão neste dia.'),
      rows.length ? h('ul', { class: 'cal-sessions' }, rows.map(s => h('li', {},
        h('strong', {}, formatDuration(s.minutes)), ` ${actLabel(s.activity)} em ${discName(s.disciplineId)}`,
        s.notes && h('div', { class: 'muted' }, s.notes)))) : null
    ].filter(Boolean));
  }

  function draw() {
    titleEl.textContent = monthName.format(new Date(state.year, state.month0, 1));
    next.disabled = state.year === ty && state.month0 === tm - 1;
    const cells = monthMatrix(state.year, state.month0).flat().map(key => {
      if (!key) return h('span', { class: 'cal-empty' });
      const min = byDay.get(key) || 0;
      const future = key > today;
      const day = Number(key.slice(8));
      const label = `${formatDateBR(key)}: ${min ? `${formatDuration(min)} estudados` : 'sem estudo'}${key === today ? ' (hoje)' : ''}`;
      return h('button', {
        type: 'button', disabled: future, 'aria-label': label, 'aria-pressed': key === state.selected ? 'true' : 'false',
        class: `cal-day l${intensityLevel(min)}${key === today ? ' today' : ''}${key === state.selected ? ' selected' : ''}`,
        onclick: () => { state.selected = key; draw(); }
      }, h('span', { class: 'cal-num' }, String(day)), min ? h('span', { class: 'cal-min' }, formatDuration(min)) : null);
    });
    gridEl.replaceChildren(...WEEKDAYS.map(w => h('span', { class: 'cal-wd' }, w)), ...cells);
    drawDay();
  }

  box.replaceChildren(
    h('div', { class: 'cal-head' }, prev, titleEl, next),
    gridEl,
    h('ul', { class: 'cal-legend' }, LEGEND.map(([l, t]) => h('li', {}, h('span', { class: `swatch l${l}` }), t))),
    h('p', { class: 'muted cal-note' }, 'A intensidade mostra o volume de estudo do dia, não a qualidade.'),
    dayBox);
  draw();
}
