import { h, toast, shorten, statCard } from './ui.js';
import {
  flattenLeaves, formatDateBR, todayKey, parseQuestionCounts, summarizeQuestions, formatPercent
} from './calculations.js';
import { saveQuestion, deleteQuestion } from './storage.js';

export function renderPerformance(root, ctx) {
  const discs = ctx.edital.disciplines;
  const discName = id => discs.find(d => d.id === id)?.name ?? id;
  const topicsOf = id => flattenLeaves(discs.find(d => d.id === id)?.topics ?? []);
  const topicTitle = (discId, topicId) => topicsOf(discId).find(t => t.id === topicId)?.title ?? '';
  const sourcesList = () => [...new Set(ctx.questions.map(q => q.source).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const state = { editing: null, f: { from: '', to: '', disc: 'all', topic: 'all', src: 'all' } };
  const formBox = h('div', { class: 'card' });
  const summary = h('div', { class: 'grid' });
  const listEl = h('ul', { class: 'sessions' });
  const filtersBox = h('div', { class: 'card' });

  const topicOptions = (discId, first, selected) => [
    h('option', { value: first[0] }, first[1]),
    ...topicsOf(discId).map(t => h('option', { value: t.id, selected: t.id === selected }, shorten(t.title)))
  ];

  // ---------- Formulário ----------
  function renderForm() {
    const q = state.editing;
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const date = h('input', { id: 'q-date', type: 'date', max: todayKey(), value: q?.date ?? todayKey(), required: true });
    const disc = h('select', { id: 'q-disc', required: true },
      h('option', { value: '' }, 'Selecione a disciplina'),
      discs.map(d => h('option', { value: d.id, selected: d.id === q?.disciplineId }, d.name)));
    const topic = h('select', { id: 'q-topic' });
    const fillTopic = selected => topic.replaceChildren(...topicOptions(disc.value, ['', 'Disciplina inteira (sem assunto específico)'], selected));
    fillTopic(q?.topicId);
    disc.addEventListener('change', () => fillTopic(null));
    const source = h('input', { id: 'q-source', type: 'text', list: 'q-sources', maxlength: '60', placeholder: 'Ex.: plataforma, caderno, simulado', value: q?.source ?? '' });
    const total = h('input', { id: 'q-total', type: 'number', min: '1', max: '1000', inputmode: 'numeric', value: q?.total ?? '' });
    const correct = h('input', { id: 'q-correct', type: 'number', min: '0', max: '1000', inputmode: 'numeric', value: q?.correct ?? '' });
    const readout = h('p', { class: 'muted readout' });
    const notes = h('textarea', { id: 'q-notes' }, q?.notes ?? '');

    const updateReadout = () => {
      try {
        const c = parseQuestionCounts(total.value, correct.value);
        readout.textContent = `Erros: ${c.wrong}. Aproveitamento: ${formatPercent((c.correct / c.total) * 100)}.`;
      } catch { readout.textContent = ''; }
    };
    total.addEventListener('input', updateReadout);
    correct.addEventListener('input', updateReadout);
    updateReadout();

    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      try {
        if (!date.value) throw new Error('Informe a data.');
        if (date.value > todayKey()) throw new Error('A data não pode ser futura.');
        if (!disc.value) throw new Error('Selecione a disciplina.');
        const c = parseQuestionCounts(total.value, correct.value);
        const data = {
          date: date.value, disciplineId: disc.value, topicId: topic.value || null,
          source: source.value.trim(), total: c.total, correct: c.correct,
          notes: notes.value.trim(), createdAtMs: q?.createdAtMs ?? Date.now()
        };
        if (q) data.id = q.id;
        saveBtn.disabled = true;
        const id = await saveQuestion(ctx.user.uid, data);
        const saved = { ...data, id };
        ctx.questions = q ? ctx.questions.map(x => (x.id === id ? saved : x)) : [...ctx.questions, saved];
        toast(q ? 'Registro atualizado' : 'Questões registradas');
        state.editing = null;
        renderForm();
        renderFilters();
        renderList();
      } catch (ex) {
        err.textContent = ex.code ? 'Não foi possível salvar. Verifique a conexão e as regras do Firestore.' : ex.message;
        err.hidden = false;
        saveBtn.disabled = false;
        if (ex.code) console.error(ex);
      }
    } },
      h('div', { class: 'form-grid' },
        h('div', {}, h('label', { for: 'q-date' }, 'Data'), date),
        h('div', {}, h('label', { for: 'q-source' }, 'Fonte (opcional)'), source),
        h('div', {}, h('label', { for: 'q-disc' }, 'Disciplina'), disc),
        h('div', {}, h('label', { for: 'q-topic' }, 'Assunto (opcional)'), topic),
        h('div', {}, h('label', { for: 'q-total' }, 'Total de questões'), total),
        h('div', {}, h('label', { for: 'q-correct' }, 'Acertos'), correct),
        h('div', { class: 'wide' }, readout),
        h('div', { class: 'wide' }, h('label', { for: 'q-notes' }, 'Observações'), notes)),
      h('datalist', { id: 'q-sources' }, sourcesList().map(s => h('option', { value: s }))),
      err,
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn primary', id: 'q-save' }, q ? 'Salvar alterações' : 'Registrar questões'),
        q && h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.editing = null; renderForm(); } }, 'Cancelar')));
    const saveBtn = form.querySelector('#q-save');
    formBox.replaceChildren(h('h2', {}, q ? 'Editar registro' : 'Registrar questões'), form);
  }

  // ---------- Filtros ----------
  function renderFilters() {
    const set = (k, v) => { state.f[k] = v; renderList(); };
    const fTopic = h('select', { id: 'qf-topic', disabled: state.f.disc === 'all', onchange: e => set('topic', e.target.value) },
      ...(state.f.disc === 'all'
        ? [h('option', { value: 'all' }, 'Todos os assuntos')]
        : topicOptions(state.f.disc, ['all', 'Todos os assuntos'], state.f.topic)));
    const fDisc = h('select', { id: 'qf-disc', onchange: e => {
      state.f.disc = e.target.value; state.f.topic = 'all';
      fTopic.replaceChildren(...(e.target.value === 'all'
        ? [h('option', { value: 'all' }, 'Todos os assuntos')]
        : topicOptions(e.target.value, ['all', 'Todos os assuntos'], null)));
      fTopic.disabled = e.target.value === 'all';
      renderList();
    } }, h('option', { value: 'all' }, 'Todas as disciplinas'),
      discs.map(d => h('option', { value: d.id, selected: d.id === state.f.disc }, d.name)));
    const srcs = sourcesList();
    if (state.f.src !== 'all' && !srcs.includes(state.f.src)) state.f.src = 'all';
    const fSrc = h('select', { id: 'qf-src', onchange: e => set('src', e.target.value) },
      h('option', { value: 'all' }, 'Todas as fontes'),
      srcs.map(s => h('option', { value: s, selected: s === state.f.src }, s)));
    filtersBox.replaceChildren(h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'qf-from' }, 'De'), h('input', { id: 'qf-from', type: 'date', value: state.f.from, onchange: e => set('from', e.target.value) })),
      h('div', {}, h('label', { for: 'qf-to' }, 'Até'), h('input', { id: 'qf-to', type: 'date', value: state.f.to, onchange: e => set('to', e.target.value) })),
      h('div', {}, h('label', { for: 'qf-disc' }, 'Disciplina'), fDisc),
      h('div', {}, h('label', { for: 'qf-topic' }, 'Assunto'), fTopic),
      h('div', {}, h('label', { for: 'qf-src' }, 'Fonte'), fSrc),
      h('div', { class: 'align-end' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => {
        state.f = { from: '', to: '', disc: 'all', topic: 'all', src: 'all' };
        renderFilters(); renderList();
      } }, 'Limpar filtros'))));
  }

  // ---------- Histórico ----------
  function filtered() {
    const f = state.f;
    return ctx.questions
      .filter(r => (!f.from || r.date >= f.from) && (!f.to || r.date <= f.to)
        && (f.disc === 'all' || r.disciplineId === f.disc)
        && (f.topic === 'all' || r.topicId === f.topic)
        && (f.src === 'all' || r.source === f.src))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  }

  async function remove(r) {
    if (!confirm(`Excluir o registro de ${formatDateBR(r.date)} (${r.correct} acertos em ${r.total} questões)? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteQuestion(ctx.user.uid, r.id);
      ctx.questions = ctx.questions.filter(x => x.id !== r.id);
      if (state.editing?.id === r.id) { state.editing = null; renderForm(); }
      toast('Registro excluído');
      renderFilters();
      renderList();
    } catch (e) {
      console.error(e);
      toast('Não foi possível excluir. Verifique a conexão.', 'error');
    }
  }

  function renderList() {
    const rows = filtered();
    const sum = summarizeQuestions(rows);
    summary.replaceChildren(
      statCard('Questões resolvidas', rows.length ? String(sum.total) : 'Sem dados', rows.length ? `${rows.length} registro${rows.length > 1 ? 's' : ''}` : null),
      statCard('Acertos', rows.length ? String(sum.correct) : 'Sem dados'),
      statCard('Erros', rows.length ? String(sum.wrong) : 'Sem dados'),
      statCard('Taxa de acertos', formatPercent(sum.rate), rows.length ? `${sum.correct} de ${sum.total} questões` : null));
    if (!rows.length) {
      listEl.replaceChildren(h('li', { class: 'empty' }, ctx.questions.length
        ? 'Nenhum registro com esses filtros.'
        : 'Nenhum registro ainda. Use o formulário acima para registrar as questões que você resolveu.'));
      return;
    }
    listEl.replaceChildren(...rows.map(r => {
      const title = r.topicId ? topicTitle(r.disciplineId, r.topicId) : '';
      return h('li', { class: 'session' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' },
            h('strong', {}, formatDateBR(r.date)),
            r.source && h('span', { class: 'chip' }, r.source),
            h('span', { class: 'session-dur' }, `${r.correct}/${r.total} (${formatPercent((r.correct / r.total) * 100)})`)),
          h('div', {}, discName(r.disciplineId)),
          title && h('div', { class: 'muted' }, shorten(title, 120)),
          h('div', { class: 'muted' }, `Erros: ${r.total - r.correct}`),
          r.notes && h('div', { class: 'muted session-notes' }, r.notes)),
        h('div', { class: 'session-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.editing = r; renderForm(); formBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Editar'),
          h('button', { class: 'btn ghost danger', type: 'button', onclick: () => remove(r) }, 'Excluir')));
    }));
  }

  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Desempenho'),
      h('p', {}, 'Registre as questões que você resolveu e acompanhe o aproveitamento. Gráficos e comparações chegam na Etapa 7.')),
    formBox,
    h('div', { class: 'section' }, h('h2', {}, 'Histórico de questões'), filtersBox,
      h('div', { class: 'section-tight' }, summary), listEl));
  renderForm();
  renderFilters();
  renderList();
}
