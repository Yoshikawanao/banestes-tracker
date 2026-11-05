import { h, toast, shorten, statCard } from './ui.js';
import {
  flattenLeaves, sumMinutes, distinctDays, formatDuration, formatDateBR, todayKey, parseDuration
} from './calculations.js';
import { saveSession, deleteSession } from './storage.js';
import { ACTIVITIES, actLabel } from './constants.js';
import { renderTimer } from './timer.js';

export function renderSessions(root, ctx) {
  const discs = ctx.edital.disciplines;
  const discName = id => discs.find(d => d.id === id)?.name ?? id;
  const topicsOf = id => flattenLeaves(discs.find(d => d.id === id)?.topics ?? []);
  const topicTitle = (discId, topicId) => topicsOf(discId).find(t => t.id === topicId)?.title ?? '';

  const state = { editing: null, f: { from: '', to: '', disc: 'all', topic: 'all', act: 'all' } };

  const timerBox = h('div', { class: 'card' });
  const formBox = h('div', { class: 'card' });
  const summary = h('div', { class: 'grid' });
  const listEl = h('ul', { class: 'sessions' });

  const topicOptions = (discId, emptyLabel, selected) => [
    h('option', { value: emptyLabel[0] }, emptyLabel[1]),
    ...topicsOf(discId).map(t => h('option', { value: t.id, selected: t.id === selected }, shorten(t.title)))
  ];

  // ---------- Formulário ----------
  function renderForm() {
    const s = state.editing;
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const date = h('input', { id: 's-date', type: 'date', max: todayKey(), value: s?.date ?? todayKey(), required: true });
    const disc = h('select', { id: 's-disc', required: true },
      h('option', { value: '' }, 'Selecione a disciplina'),
      discs.map(d => h('option', { value: d.id, selected: d.id === s?.disciplineId }, d.name)));
    const topic = h('select', { id: 's-topic' });
    const fillTopic = selected => topic.replaceChildren(...topicOptions(disc.value, ['', 'Disciplina inteira (sem assunto específico)'], selected));
    fillTopic(s?.topicId);
    disc.addEventListener('change', () => fillTopic(null));
    const act = h('select', { id: 's-act' }, ACTIVITIES.map(([v, l]) => h('option', { value: v, selected: v === (s?.activity ?? 'teoria') }, l)));
    const hours = h('input', { id: 's-h', type: 'number', min: '0', max: '24', inputmode: 'numeric', placeholder: '0', value: s ? Math.floor(s.minutes / 60) : '' });
    const mins = h('input', { id: 's-m', type: 'number', min: '0', max: '59', inputmode: 'numeric', placeholder: '0', value: s ? s.minutes % 60 : '' });
    const notes = h('textarea', { id: 's-notes' }, s?.notes ?? '');

    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      try {
        if (!date.value) throw new Error('Informe a data.');
        if (date.value > todayKey()) throw new Error('A data não pode ser futura.');
        if (!disc.value) throw new Error('Selecione a disciplina.');
        const minutes = parseDuration(hours.value, mins.value);
        const data = {
          date: date.value, disciplineId: disc.value, topicId: topic.value || null,
          activity: act.value, minutes, notes: notes.value.trim(), source: 'manual',
          createdAtMs: s?.createdAtMs ?? Date.now()
        };
        if (s) data.id = s.id;
        saveBtn.disabled = true;
        const id = await saveSession(ctx.user.uid, data);
        const saved = { ...data, id };
        ctx.sessions = s ? ctx.sessions.map(x => (x.id === id ? saved : x)) : [...ctx.sessions, saved];
        toast(s ? 'Sessão atualizada' : 'Sessão registrada');
        state.editing = null;
        renderForm();
        renderList();
      } catch (ex) {
        err.textContent = ex.code ? 'Não foi possível salvar. Verifique a conexão e as regras do Firestore.' : ex.message;
        err.hidden = false;
        saveBtn.disabled = false;
        if (ex.code) console.error(ex);
      }
    } },
      h('div', { class: 'form-grid' },
        h('div', {}, h('label', { for: 's-date' }, 'Data'), date),
        h('div', {}, h('label', { for: 's-act' }, 'Atividade'), act),
        h('div', {}, h('label', { for: 's-disc' }, 'Disciplina'), disc),
        h('div', {}, h('label', { for: 's-topic' }, 'Assunto (opcional)'), topic),
        h('div', {}, h('label', { for: 's-h' }, 'Horas'), hours),
        h('div', {}, h('label', { for: 's-m' }, 'Minutos'), mins),
        h('div', { class: 'wide' }, h('label', { for: 's-notes' }, 'Observações'), notes)),
      err,
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn primary', id: 's-save' }, s ? 'Salvar alterações' : 'Registrar sessão'),
        s && h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.editing = null; renderForm(); } }, 'Cancelar')));
    const saveBtn = form.querySelector('#s-save');
    formBox.replaceChildren(h('h2', {}, s ? 'Editar sessão' : 'Registrar manualmente'), form);
  }

  // ---------- Histórico ----------
  function filtered() {
    const f = state.f;
    return ctx.sessions
      .filter(s => (!f.from || s.date >= f.from) && (!f.to || s.date <= f.to)
        && (f.disc === 'all' || s.disciplineId === f.disc)
        && (f.topic === 'all' || s.topicId === f.topic)
        && (f.act === 'all' || s.activity === f.act))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }

  async function remove(s) {
    if (!confirm(`Excluir a sessão de ${formatDateBR(s.date)} (${formatDuration(s.minutes)})? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteSession(ctx.user.uid, s.id);
      ctx.sessions = ctx.sessions.filter(x => x.id !== s.id);
      if (state.editing?.id === s.id) { state.editing = null; renderForm(); }
      toast('Sessão excluída');
      renderList();
    } catch (e) {
      console.error(e);
      toast('Não foi possível excluir. Verifique a conexão.', 'error');
    }
  }

  function renderList() {
    const rows = filtered();
    summary.replaceChildren(
      statCard('Sessões', String(rows.length), ctx.sessions.length !== rows.length ? `de ${ctx.sessions.length} no total` : null),
      statCard('Tempo estudado', rows.length ? formatDuration(sumMinutes(rows)) : 'Sem dados'),
      statCard('Dias estudados', rows.length ? String(distinctDays(rows)) : 'Sem dados'));
    if (!rows.length) {
      listEl.replaceChildren(h('li', { class: 'empty' }, ctx.sessions.length
        ? 'Nenhuma sessão com esses filtros.'
        : 'Nenhuma sessão registrada ainda. Use o formulário acima para registrar a primeira.'));
      return;
    }
    listEl.replaceChildren(...rows.map(s => {
      const title = s.topicId ? topicTitle(s.disciplineId, s.topicId) : '';
      return h('li', { class: 'session' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' },
            h('strong', {}, formatDateBR(s.date)),
            h('span', { class: 'chip' }, actLabel(s.activity)),
            h('span', { class: 'session-dur' }, formatDuration(s.minutes))),
          h('div', {}, discName(s.disciplineId)),
          title && h('div', { class: 'muted' }, shorten(title, 120)),
          s.notes && h('div', { class: 'muted session-notes' }, s.notes)),
        h('div', { class: 'session-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.editing = s; renderForm(); formBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Editar'),
          h('button', { class: 'btn ghost danger', type: 'button', onclick: () => remove(s) }, 'Excluir')));
    }));
  }

  // ---------- Filtros ----------
  const fTopic = h('select', { id: 'f-topic', disabled: true }, h('option', { value: 'all' }, 'Todos os assuntos'));
  const set = (k, v) => { state.f[k] = v; renderList(); };
  const fDisc = h('select', { id: 'f-disc', onchange: e => {
    state.f.disc = e.target.value;
    state.f.topic = 'all';
    fTopic.replaceChildren(...(e.target.value === 'all'
      ? [h('option', { value: 'all' }, 'Todos os assuntos')]
      : topicOptions(e.target.value, ['all', 'Todos os assuntos'], null)));
    fTopic.disabled = e.target.value === 'all';
    renderList();
  } }, h('option', { value: 'all' }, 'Todas as disciplinas'), discs.map(d => h('option', { value: d.id }, d.name)));
  const fFrom = h('input', { id: 'f-from', type: 'date', onchange: e => set('from', e.target.value) });
  const fTo = h('input', { id: 'f-to', type: 'date', onchange: e => set('to', e.target.value) });
  const fAct = h('select', { id: 'f-act', onchange: e => set('act', e.target.value) },
    h('option', { value: 'all' }, 'Todas as atividades'), ACTIVITIES.map(([v, l]) => h('option', { value: v }, l)));
  fTopic.addEventListener('change', e => set('topic', e.target.value));

  const filters = h('div', { class: 'card' },
    h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'f-from' }, 'De'), fFrom),
      h('div', {}, h('label', { for: 'f-to' }, 'Até'), fTo),
      h('div', {}, h('label', { for: 'f-disc' }, 'Disciplina'), fDisc),
      h('div', {}, h('label', { for: 'f-topic' }, 'Assunto'), fTopic),
      h('div', {}, h('label', { for: 'f-act' }, 'Atividade'), fAct),
      h('div', { class: 'align-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        state.f = { from: '', to: '', disc: 'all', topic: 'all', act: 'all' };
        fFrom.value = ''; fTo.value = ''; fDisc.value = 'all'; fAct.value = 'all';
        fTopic.replaceChildren(h('option', { value: 'all' }, 'Todos os assuntos'));
        fTopic.disabled = true;
        renderList();
      } }, 'Limpar filtros'))));

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Estudos'),
      h('p', {}, 'Use o cronômetro enquanto estuda ou registre uma sessão manualmente.')),
    timerBox,
    h('div', { class: 'section-tight' }, formBox),
    h('div', { class: 'section' }, h('h2', {}, 'Histórico'), filters, h('div', { class: 'section-tight' }, summary), listEl));
  renderTimer(timerBox, ctx, () => renderList());
  renderForm();
  renderList();
}
