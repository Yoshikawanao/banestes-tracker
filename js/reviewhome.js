import { h, toast, shorten, statCard } from './ui.js';
import { todayKey, cardStatus, dueLabel, scheduleCard, intervalLabel, formatDateBR } from './calculations.js';
import { RATINGS, reasonLabel } from './constants.js';
import { discOptions, discNameOf } from './forms.js';
import { saveFlashcard, saveMistake } from './storage.js';

export function renderReviewHome(root, ctx, goTo) {
  const today = todayKey();
  const discs = ctx.edital.disciplines;
  const state = { disc: 'all' };
  const box = h('div');
  const byDue = (a, b) => a.dueDate.localeCompare(b.dueDate) || (a.createdAtMs ?? 0) - (b.createdAtMs ?? 0);
  const dueCards = () => ctx.flashcards.filter(c => cardStatus(c, today) === 'pendente' && (state.disc === 'all' || c.disciplineId === state.disc)).sort(byDue);

  // ---------- Tela inicial ----------
  function home() {
    const due = dueCards();
    const soon = ctx.flashcards.filter(c => cardStatus(c, today) === 'proximo').sort(byDue);
    const pendingMistakes = ctx.mistakes.filter(m => m.status === 'pendente').sort((a, b) => b.date.localeCompare(a.date));
    const hasCards = ctx.flashcards.length > 0;
    box.replaceChildren(
      h('div', { class: 'grid' },
        statCard('Flashcards para revisar', hasCards ? String(dueCards().length) : 'Sem dados', hasCards ? 'Vencem hoje ou estão atrasados' : 'Crie cartões na aba Flashcards'),
        statCard('Próximos a vencer', hasCards ? String(soon.length) : 'Sem dados', 'Em 1 a 3 dias'),
        statCard('Erros a revisar', ctx.mistakes.length ? String(pendingMistakes.length) : 'Sem dados', ctx.mistakes.length ? 'No caderno de erros' : 'Registre erros na aba Caderno de erros')),
      h('div', { class: 'section' }, h('h2', {}, 'Revisar flashcards'),
        h('div', { class: 'card' },
          h('div', { class: 'form-grid' }, h('div', {}, h('label', { for: 'rv-disc' }, 'Disciplina'),
            h('select', { id: 'rv-disc', onchange: e => { state.disc = e.target.value; home(); } }, discOptions(discs, state.disc, ['all', 'Todas as disciplinas'])))),
          h('div', { class: 'form-actions' },
            h('button', { class: 'btn primary', type: 'button', disabled: !due.length, onclick: () => startSession(due) },
              due.length ? `Iniciar revisão (${due.length} cartão${due.length > 1 ? 'ões' : ''})` : 'Nenhum cartão para revisar agora')),
          soon.length ? h('div', { class: 'section-tight' }, h('strong', {}, 'Próximos a vencer'),
            h('ul', { class: 'plain-list' }, soon.slice(0, 5).map(c => h('li', {}, `${shorten(c.front, 80)} (${dueLabel(c, today).toLowerCase()})`)))) : null)),
      h('div', { class: 'section' }, h('h2', {}, 'Erros a revisar'),
        pendingMistakes.length
          ? h('ul', { class: 'sessions' }, pendingMistakes.slice(0, 8).map(m => h('li', { class: 'session' },
              h('div', { class: 'session-main' },
                h('div', { class: 'session-top' }, h('strong', {}, formatDateBR(m.date)), h('span', { class: 'chip' }, reasonLabel(m.reason))),
                h('div', {}, discNameOf(discs, m.disciplineId)),
                h('details', { class: 'sim-details' }, h('summary', {}, shorten(m.statement, 140)),
                  h('div', { class: 'session-notes' }, m.statement),
                  h('div', {}, h('strong', {}, `Você marcou ${m.chosen}; a correta é ${m.correct}.`)),
                  m.explanation ? h('div', { class: 'muted session-notes' }, `Explicação: ${m.explanation}`) : null,
                  m.action ? h('div', { class: 'muted session-notes' }, `Ação corretiva: ${m.action}`) : null)),
              h('div', { class: 'session-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => {
                const next = { ...m, status: 'revisado', reviewedAt: today };
                try {
                  await saveMistake(ctx.user.uid, next);
                  ctx.mistakes = ctx.mistakes.map(x => (x.id === m.id ? next : x));
                  toast('Marcado como revisado');
                  home();
                } catch (e) { console.error(e); toast('Não foi possível salvar. Verifique a conexão.', 'error'); }
              } }, 'Marcar revisado')))))
          : h('div', { class: 'empty' }, ctx.mistakes.length ? 'Nenhum erro a revisar. Bom trabalho.' : 'Nenhum erro registrado ainda.'),
        pendingMistakes.length > 8 ? h('p', { class: 'muted note' }, `Mostrando 8 de ${pendingMistakes.length}. Veja todos na aba Caderno de erros.`) : null,
        h('p', {}, h('button', { class: 'btn ghost', type: 'button', onclick: () => goTo('erros') }, 'Abrir caderno de erros'))));
  }

  // ---------- Sessão de revisão ----------
  function startSession(queue) {
    const s = { queue, i: 0, revealed: false, busy: false, counts: { errei: 0, dificil: 0, bom: 0, facil: 0 } };

    async function rate(rating) {
      if (s.busy) return;
      s.busy = true;
      const card = s.queue[s.i];
      const updated = { ...card, ...scheduleCard(card, rating, today), lastReviewedAt: today };
      try {
        await saveFlashcard(ctx.user.uid, updated);
        ctx.flashcards = ctx.flashcards.map(x => (x.id === card.id ? updated : x));
        s.counts[rating] += 1; s.i += 1; s.revealed = false;
      } catch (e) { console.error(e); toast('Não foi possível salvar a avaliação. Verifique a conexão.', 'error'); }
      s.busy = false;
      draw();
    }

    function draw() {
      if (s.i >= s.queue.length) {
        const total = s.queue.length;
        box.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Revisão concluída'),
          h('p', {}, `${total} cartão${total > 1 ? 'ões' : ''} revisado${total > 1 ? 's' : ''}.`),
          h('ul', { class: 'plain-list' }, RATINGS.map(([k, l]) => h('li', {}, `${l}: ${s.counts[k]}`))),
          h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: home }, 'Voltar'))));
        return;
      }
      const card = s.queue[s.i];
      box.replaceChildren(h('div', { class: 'card' },
        h('div', { class: 'session-top' }, h('strong', {}, `Cartão ${s.i + 1} de ${s.queue.length}`), h('span', { class: 'muted' }, discNameOf(discs, card.disciplineId))),
        h('div', { class: 'fc-face' }, card.front),
        s.revealed
          ? h('div', {},
              h('div', { class: 'fc-face fc-back' }, card.back),
              h('p', { class: 'muted note' }, 'Como foi? Entre parênteses, quando o cartão volta.'),
              h('div', { class: 'rating-row' }, RATINGS.map(([k, l]) => h('button', { class: 'btn', type: 'button', onclick: () => rate(k) },
                `${l} (${intervalLabel(scheduleCard(card, k, today).intervalDays)})`))))
          : h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { s.revealed = true; draw(); } }, 'Mostrar resposta')),
        h('div', { class: 'form-actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: home }, 'Encerrar revisão'))));
    }
    draw();
  }

  root.replaceChildren(box);
  home();
}
