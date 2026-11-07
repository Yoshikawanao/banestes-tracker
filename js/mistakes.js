import { h, toast, shorten, statCard } from './ui.js';
import { formatDateBR, todayKey, validateMistakeInput, countBy } from './calculations.js';
import { REASONS, reasonLabel, ALTERNATIVES } from './constants.js';
import { discOptions, topicOptionsFor, topicTitleOf, discNameOf } from './forms.js';
import { barsHorizontal } from './charts.js';
import { saveMistake, deleteMistake } from './storage.js';

export function renderMistakes(root, ctx) {
  const discs = ctx.edital.disciplines;
  const state = { editing: null, f: { disc: 'all', topic: 'all', reason: 'all', status: 'all', q: '' } };
  const formBox = h('div', { class: 'card' });
  const filtersBox = h('div', { class: 'card' });
  const summary = h('div', { class: 'grid' });
  const chartBox = h('div', { class: 'card' });
  const listEl = h('ul', { class: 'sessions' });
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  // ---------- Formulário ----------
  function renderForm() {
    const m = state.editing;
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const date = h('input', { id: 'e-date', type: 'date', max: todayKey(), value: m?.date ?? todayKey() });
    const disc = h('select', { id: 'e-disc' }, discOptions(discs, m?.disciplineId, ['', 'Selecione a disciplina']));
    const topic = h('select', { id: 'e-topic' }, topicOptionsFor(discs, m?.disciplineId, ['', 'Disciplina inteira (sem assunto específico)'], m?.topicId));
    disc.addEventListener('change', () => topic.replaceChildren(...topicOptionsFor(discs, disc.value, ['', 'Disciplina inteira (sem assunto específico)'], null)));
    const statement = h('textarea', { id: 'e-statement', maxlength: '1500', placeholder: 'Enunciado ou um resumo da questão' }, m?.statement ?? '');
    const alt = (id, sel) => h('select', { id }, h('option', { value: '' }, 'Selecione'), ALTERNATIVES.map(a => h('option', { value: a, selected: a === sel }, a)));
    const chosen = alt('e-chosen', m?.chosen);
    const correct = alt('e-correct', m?.correct);
    const reason = h('select', { id: 'e-reason' }, h('option', { value: '' }, 'Selecione o motivo'), REASONS.map(([v, l]) => h('option', { value: v, selected: v === m?.reason }, l)));
    const explanation = h('textarea', { id: 'e-expl', maxlength: '1500', placeholder: 'Por que a resposta correta está certa?' }, m?.explanation ?? '');
    const action = h('textarea', { id: 'e-action', maxlength: '1000', placeholder: 'O que você vai fazer para não errar de novo?' }, m?.action ?? '');
    const status = h('select', { id: 'e-status' },
      h('option', { value: 'pendente', selected: (m?.status ?? 'pendente') === 'pendente' }, 'A revisar'),
      h('option', { value: 'revisado', selected: m?.status === 'revisado' }, 'Revisado'));

    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      try {
        const input = { date: date.value, disciplineId: disc.value, statement: statement.value, chosen: chosen.value, correct: correct.value, reason: reason.value };
        validateMistakeInput(input, todayKey());
        const data = {
          ...input, statement: statement.value.trim(), topicId: topic.value || null,
          explanation: explanation.value.trim(), action: action.value.trim(), status: status.value,
          reviewedAt: status.value === 'revisado' ? (m?.reviewedAt ?? todayKey()) : null,
          createdAtMs: m?.createdAtMs ?? Date.now()
        };
        if (m) data.id = m.id;
        saveBtn.disabled = true;
        const id = await saveMistake(ctx.user.uid, data);
        const saved = { ...data, id };
        ctx.mistakes = m ? ctx.mistakes.map(x => (x.id === id ? saved : x)) : [...ctx.mistakes, saved];
        toast(m ? 'Erro atualizado' : 'Erro registrado');
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
        h('div', {}, h('label', { for: 'e-date' }, 'Data'), date),
        h('div', {}, h('label', { for: 'e-reason' }, 'Motivo do erro'), reason),
        h('div', {}, h('label', { for: 'e-disc' }, 'Disciplina'), disc),
        h('div', {}, h('label', { for: 'e-topic' }, 'Assunto (opcional)'), topic),
        h('div', { class: 'wide' }, h('label', { for: 'e-statement' }, 'Enunciado ou resumo'), statement),
        h('div', {}, h('label', { for: 'e-chosen' }, 'Resposta escolhida'), chosen),
        h('div', {}, h('label', { for: 'e-correct' }, 'Resposta correta'), correct),
        h('div', { class: 'wide' }, h('label', { for: 'e-expl' }, 'Explicação (opcional)'), explanation),
        h('div', { class: 'wide' }, h('label', { for: 'e-action' }, 'Ação corretiva (opcional)'), action),
        h('div', {}, h('label', { for: 'e-status' }, 'Status da revisão'), status)),
      err,
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn primary', id: 'e-save' }, m ? 'Salvar alterações' : 'Registrar erro'),
        m && h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.editing = null; renderForm(); } }, 'Cancelar')));
    const saveBtn = form.querySelector('#e-save');
    formBox.replaceChildren(h('h2', {}, m ? 'Editar erro' : 'Registrar erro'), form);
  }

  // ---------- Filtros ----------
  function renderFilters() {
    const set = (k, v) => { state.f[k] = v; renderList(); };
    const fTopic = h('select', { id: 'ef-topic', disabled: state.f.disc === 'all', onchange: e => set('topic', e.target.value) },
      ...(state.f.disc === 'all' ? [h('option', { value: 'all' }, 'Todos os assuntos')] : topicOptionsFor(discs, state.f.disc, ['all', 'Todos os assuntos'], state.f.topic)));
    const fDisc = h('select', { id: 'ef-disc', onchange: e => {
      state.f.disc = e.target.value; state.f.topic = 'all';
      fTopic.replaceChildren(...(e.target.value === 'all' ? [h('option', { value: 'all' }, 'Todos os assuntos')] : topicOptionsFor(discs, e.target.value, ['all', 'Todos os assuntos'], null)));
      fTopic.disabled = e.target.value === 'all';
      renderList();
    } }, discOptions(discs, state.f.disc, ['all', 'Todas as disciplinas']));
    filtersBox.replaceChildren(h('div', { class: 'form-grid' },
      h('div', {}, h('label', { for: 'ef-disc' }, 'Disciplina'), fDisc),
      h('div', {}, h('label', { for: 'ef-topic' }, 'Assunto'), fTopic),
      h('div', {}, h('label', { for: 'ef-reason' }, 'Motivo'), h('select', { id: 'ef-reason', onchange: e => set('reason', e.target.value) },
        h('option', { value: 'all' }, 'Todos os motivos'), REASONS.map(([v, l]) => h('option', { value: v, selected: v === state.f.reason }, l)))),
      h('div', {}, h('label', { for: 'ef-status' }, 'Status'), h('select', { id: 'ef-status', onchange: e => set('status', e.target.value) },
        [['all', 'Todos'], ['pendente', 'A revisar'], ['revisado', 'Revisado']].map(([v, l]) => h('option', { value: v, selected: v === state.f.status }, l)))),
      h('div', { class: 'wide' }, h('label', { for: 'ef-q' }, 'Buscar no enunciado, explicação ou ação'),
        h('input', { id: 'ef-q', type: 'search', value: state.f.q, oninput: e => set('q', e.target.value) }))));
  }

  // ---------- Lista ----------
  const filtered = () => {
    const f = state.f; const q = norm(f.q.trim());
    return ctx.mistakes
      .filter(m => (f.disc === 'all' || m.disciplineId === f.disc) && (f.topic === 'all' || m.topicId === f.topic)
        && (f.reason === 'all' || m.reason === f.reason) && (f.status === 'all' || m.status === f.status)
        && (!q || norm(`${m.statement} ${m.explanation} ${m.action}`).includes(q)))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));
  };

  async function toggleReviewed(m) {
    const next = { ...m, status: m.status === 'revisado' ? 'pendente' : 'revisado' };
    next.reviewedAt = next.status === 'revisado' ? todayKey() : null;
    try {
      await saveMistake(ctx.user.uid, next);
      ctx.mistakes = ctx.mistakes.map(x => (x.id === m.id ? next : x));
      toast(next.status === 'revisado' ? 'Marcado como revisado' : 'Voltou para a revisar');
      renderList();
    } catch (e) { console.error(e); toast('Não foi possível salvar. Verifique a conexão.', 'error'); }
  }

  async function remove(m) {
    if (!confirm(`Excluir este erro de ${formatDateBR(m.date)}? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteMistake(ctx.user.uid, m.id);
      ctx.mistakes = ctx.mistakes.filter(x => x.id !== m.id);
      if (state.editing?.id === m.id) { state.editing = null; renderForm(); }
      toast('Erro excluído');
      renderList();
    } catch (e) { console.error(e); toast('Não foi possível excluir. Verifique a conexão.', 'error'); }
  }

  function renderList() {
    const rows = filtered();
    const pending = rows.filter(m => m.status === 'pendente').length;
    summary.replaceChildren(
      statCard('Erros registrados', rows.length ? String(rows.length) : 'Sem dados', rows.length !== ctx.mistakes.length ? `de ${ctx.mistakes.length} no total` : null),
      statCard('A revisar', rows.length ? String(pending) : 'Sem dados'),
      statCard('Revisados', rows.length ? String(rows.length - pending) : 'Sem dados'));
    const reasons = [...countBy(rows, m => m.reason)].sort((a, b) => b[1] - a[1]);
    chartBox.replaceChildren(h('h3', {}, 'Motivos dos erros'),
      reasons.length
        ? barsHorizontal(reasons.map(([k, n]) => ({ label: reasonLabel(k), bars: [{ pct: (n / reasons[0][1]) * 100, text: `${n} (${Math.round((n / rows.length) * 100)}%)` }] })))
        : h('p', { class: 'muted' }, 'Sem dados.'),
      h('p', { class: 'muted chart-note' }, 'Ajuda a ver o padrão: falta de conhecimento pede estudo; desatenção e interpretação pedem treino de prova.'));
    if (!rows.length) {
      listEl.replaceChildren(h('li', { class: 'empty' }, ctx.mistakes.length ? 'Nenhum erro com esses filtros.' : 'Nenhum erro registrado ainda. Use o formulário acima.'));
      return;
    }
    listEl.replaceChildren(...rows.map(m => {
      const title = m.topicId ? topicTitleOf(discs, m.disciplineId, m.topicId) : '';
      const pend = m.status === 'pendente';
      return h('li', { class: 'session' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' },
            h('strong', {}, formatDateBR(m.date)), h('span', { class: 'chip' }, reasonLabel(m.reason)),
            h('span', { class: pend ? 'chip mid' : 'chip done' }, pend ? 'A revisar' : 'Revisado')),
          h('div', {}, discNameOf(discs, m.disciplineId)),
          title ? h('div', { class: 'muted' }, shorten(title, 120)) : null,
          h('details', { class: 'sim-details' },
            h('summary', {}, shorten(m.statement, 140)),
            h('div', { class: 'session-notes' }, m.statement),
            h('div', {}, h('strong', {}, `Você marcou ${m.chosen}; a correta é ${m.correct}.`)),
            m.explanation ? h('div', { class: 'muted session-notes' }, `Explicação: ${m.explanation}`) : null,
            m.action ? h('div', { class: 'muted session-notes' }, `Ação corretiva: ${m.action}`) : null)),
        h('div', { class: 'session-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => toggleReviewed(m) }, pend ? 'Marcar revisado' : 'Voltar p/ revisar'),
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.editing = m; renderForm(); formBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Editar'),
          h('button', { class: 'btn ghost danger', type: 'button', onclick: () => remove(m) }, 'Excluir')));
    }));
  }

  root.replaceChildren(formBox,
    h('div', { class: 'section' }, h('h2', {}, 'Caderno de erros'), filtersBox,
      h('div', { class: 'section-tight' }, summary), chartBox, h('div', { class: 'section-tight' }, listEl)));
  renderForm(); renderFilters(); renderList();
}
