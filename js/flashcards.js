import { h, toast, shorten, statCard } from './ui.js';
import { todayKey, validateCardInput, cardStatus, dueLabel, intervalLabel, NEW_CARD } from './calculations.js';
import { discOptions, topicOptionsFor, topicTitleOf, discNameOf } from './forms.js';
import { saveFlashcard, deleteFlashcard } from './storage.js';

const STATUS_FILTERS = [['all', 'Todos'], ['pendente', 'Pendentes (vencem hoje ou atrasados)'], ['proximo', 'Próximos a vencer (1 a 3 dias)'], ['futuro', 'Mais adiante']];

export function renderFlashcards(root, ctx) {
  const discs = ctx.edital.disciplines;
  const today = todayKey();
  const state = { editing: null, f: { disc: 'all', topic: 'all', status: 'all', q: '' } };
  const formBox = h('div', { class: 'card' });
  const filtersBox = h('div', { class: 'card' });
  const summary = h('div', { class: 'grid' });
  const listEl = h('ul', { class: 'sessions' });
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function renderForm() {
    const c = state.editing;
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const disc = h('select', { id: 'c-disc' }, discOptions(discs, c?.disciplineId, ['', 'Selecione a disciplina']));
    const topic = h('select', { id: 'c-topic' }, topicOptionsFor(discs, c?.disciplineId, ['', 'Disciplina inteira (sem assunto específico)'], c?.topicId));
    disc.addEventListener('change', () => topic.replaceChildren(...topicOptionsFor(discs, disc.value, ['', 'Disciplina inteira (sem assunto específico)'], null)));
    const front = h('textarea', { id: 'c-front', maxlength: '1000', placeholder: 'Pergunta' }, c?.front ?? '');
    const back = h('textarea', { id: 'c-back', maxlength: '1000', placeholder: 'Resposta' }, c?.back ?? '');
    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      try {
        const input = { disciplineId: disc.value, front: front.value, back: back.value };
        validateCardInput(input);
        const base = c ?? { ...NEW_CARD, dueDate: today, createdAtMs: Date.now() };
        const data = { ...base, disciplineId: input.disciplineId, topicId: topic.value || null, front: front.value.trim(), back: back.value.trim() };
        saveBtn.disabled = true;
        const id = await saveFlashcard(ctx.user.uid, data);
        const saved = { ...data, id };
        ctx.flashcards = c ? ctx.flashcards.map(x => (x.id === id ? saved : x)) : [...ctx.flashcards, saved];
        toast(c ? 'Cartão atualizado' : 'Cartão criado');
        state.editing = null;
        renderForm(); renderList();
      } catch (ex) {
        err.textContent = ex.code ? 'Não foi possível salvar. Verifique a conexão e as regras do Firestore.' : ex.message;
        err.hidden = false;
        saveBtn.disabled = false;
        if (ex.code) console.error(ex);
      }
    } },
      h('div', { class: 'form-grid' },
        h('div', {}, h('label', { for: 'c-disc' }, 'Disciplina'), disc),
        h('div', {}, h('label', { for: 'c-topic' }, 'Assunto (opcional)'), topic),
        h('div', { class: 'wide' }, h('label', { for: 'c-front' }, 'Pergunta'), front),
        h('div', { class: 'wide' }, h('label', { for: 'c-back' }, 'Resposta'), back)),
      err,
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn primary', id: 'c-save' }, c ? 'Salvar alterações' : 'Criar cartão'),
        c && h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.editing = null; renderForm(); } }, 'Cancelar')));
    const saveBtn = form.querySelector('#c-save');
    formBox.replaceChildren(h('h2', {}, c ? 'Editar cartão' : 'Novo flashcard'), form,
      c ? h('p', { class: 'muted note' }, 'Editar o texto não muda o agendamento das revisões.') : null);
  }

  function renderFilters() {
    const set = (k, v) => { state.f[k] = v; renderList(); };
    const fTopic = h('select', { id: 'cf-topic', disabled: state.f.disc === 'all', onchange: e => set('topic', e.target.value) },
      ...(state.f.disc === 'all' ? [h('option', { value: 'all' }, 'Todos os assuntos')] : topicOptionsFor(discs, state.f.disc, ['all', 'Todos os assuntos'], state.f.topic)));
    const fDisc = h('select', { id: 'cf-disc', onchange: e => {
      state.f.disc = e.target.value; state.f.topic = 'all';
      fTopic.replaceChildren(...(e.target.value === 'all' ? [h('option', { value: 'all' }, 'Todos os assuntos')] : topicOptionsFor(discs, e.target.value, ['all', 'Todos os assuntos'], null)));
      fTopic.disabled = e.target.value === 'all';
      renderList();
    } }, discOptions(discs, state.f.disc, ['all', 'Todas as disciplinas']));
    filtersBox.replaceChildren(h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'cf-disc' }, 'Disciplina'), fDisc),
      h('div', {}, h('label', { for: 'cf-topic' }, 'Assunto'), fTopic),
      h('div', {}, h('label', { for: 'cf-status' }, 'Situação'), h('select', { id: 'cf-status', onchange: e => set('status', e.target.value) },
        STATUS_FILTERS.map(([v, l]) => h('option', { value: v, selected: v === state.f.status }, l)))),
      h('div', {}, h('label', { for: 'cf-q' }, 'Buscar'), h('input', { id: 'cf-q', type: 'search', value: state.f.q, oninput: e => set('q', e.target.value) }))));
  }

  const filtered = () => {
    const f = state.f; const q = norm(f.q.trim());
    return ctx.flashcards
      .filter(c => (f.disc === 'all' || c.disciplineId === f.disc) && (f.topic === 'all' || c.topicId === f.topic)
        && (f.status === 'all' || cardStatus(c, today) === f.status) && (!q || norm(`${c.front} ${c.back}`).includes(q)))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0));
  };

  async function remove(c) {
    if (!confirm('Excluir este cartão? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteFlashcard(ctx.user.uid, c.id);
      ctx.flashcards = ctx.flashcards.filter(x => x.id !== c.id);
      if (state.editing?.id === c.id) { state.editing = null; renderForm(); }
      toast('Cartão excluído');
      renderList();
    } catch (e) { console.error(e); toast('Não foi possível excluir. Verifique a conexão.', 'error'); }
  }

  function renderList() {
    const rows = filtered();
    const count = s => rows.filter(c => cardStatus(c, today) === s).length;
    summary.replaceChildren(
      statCard('Cartões', rows.length ? String(rows.length) : 'Sem dados', rows.length !== ctx.flashcards.length ? `de ${ctx.flashcards.length} no total` : null),
      statCard('Pendentes', rows.length ? String(count('pendente')) : 'Sem dados', 'Vencem hoje ou estão atrasados'),
      statCard('Próximos a vencer', rows.length ? String(count('proximo')) : 'Sem dados', 'Em 1 a 3 dias'));
    if (!rows.length) {
      listEl.replaceChildren(h('li', { class: 'empty' }, ctx.flashcards.length ? 'Nenhum cartão com esses filtros.' : 'Nenhum flashcard ainda. Crie o primeiro no formulário acima.'));
      return;
    }
    listEl.replaceChildren(...rows.map(c => {
      const st = cardStatus(c, today);
      const title = c.topicId ? topicTitleOf(discs, c.disciplineId, c.topicId) : '';
      return h('li', { class: 'session' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' },
            h('span', { class: st === 'pendente' ? 'chip mid' : st === 'proximo' ? 'chip' : 'chip done' }, dueLabel(c, today)),
            c.reps > 0 ? h('span', { class: 'muted' }, `Intervalo atual: ${intervalLabel(c.intervalDays)}`) : h('span', { class: 'muted' }, 'Novo')),
          h('div', { class: 'session-notes' }, h('strong', {}, c.front)),
          h('details', { class: 'sim-details' }, h('summary', {}, 'Ver resposta'), h('div', { class: 'session-notes' }, c.back)),
          h('div', { class: 'muted' }, `${discNameOf(discs, c.disciplineId)}${title ? `: ${shorten(title, 90)}` : ''}`)),
        h('div', { class: 'session-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.editing = c; renderForm(); formBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Editar'),
          h('button', { class: 'btn ghost danger', type: 'button', onclick: () => remove(c) }, 'Excluir')));
    }));
  }

  root.replaceChildren(formBox,
    h('div', { class: 'section' }, h('h2', {}, 'Meus flashcards'), filtersBox, h('div', { class: 'section-tight' }, summary), listEl));
  renderForm(); renderFilters(); renderList();
}
