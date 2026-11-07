import { h, toast, statCard } from './ui.js';
import {
  todayKey, formatDateBR, formatDuration, formatGrade, formatPercent, MIN_GRADE,
  parseDuration, parseOptionalDuration, parseSimulationResults, simulationScores
} from './calculations.js';
import { barsVertical } from './charts.js';
import { saveSimulation, deleteSimulation } from './storage.js';

const BLOCKS = { gerais: 'Conhecimentos Gerais', especificos: 'Conhecimentos Específicos' };
const ddmm = key => formatDateBR(key).slice(0, 5);
const typeLabel = t => (t === 'completo' ? 'Completo' : 'Parcial (estimativa)');

const METHOD = [
  'Gerais = acertos ÷ 30 × 10. Específicos = acertos ÷ 40 × 10. Nota final estimada = (Gerais + 2 × Específicos) ÷ 3.',
  'Arredondamento do edital (item 14.2): duas casas decimais, e terceira casa 5 ou mais arredonda para cima. A banca pode arredondar as notas de cada bloco antes de ponderar, o que muda a final em no máximo 0,01.',
  'Simulado parcial é sempre uma estimativa: cada bloco usa a taxa de acertos das questões feitas nele (acertos ÷ total × 10). Só há nota final se houver questões dos dois blocos.',
  `A nota mínima do edital é ${formatGrade(MIN_GRADE)}, mas isso não garante aprovação: a classificação depende do cadastro de reserva do polo.`
];

export function renderSimulations(root, ctx) {
  const discs = ctx.edital.disciplines;
  const state = { editing: null };
  const formBox = h('div', { class: 'card' });
  const summary = h('div', { class: 'grid' });
  const chartBox = h('div', { class: 'card' });
  const listEl = h('ul', { class: 'sessions' });

  const scoresOf = sim => simulationScores(sim.results, discs, sim.type);
  const finalText = sc => (sc.final != null ? formatGrade(sc.final) : `Sem nota final (faltam questões de ${sc.missing.join(' e ')})`);

  // ---------- Formulário ----------
  function renderForm() {
    const sim = state.editing;
    let type = sim?.type ?? 'completo';
    const draft = Object.fromEntries(discs.map(d => {
      const r = sim?.results?.[d.id];
      return [d.id, { total: r && sim.type === 'parcial' ? String(r.total) : '', correct: r ? String(r.correct) : '' }];
    }));
    const err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const name = h('input', { id: 'm-name', type: 'text', maxlength: '80', placeholder: 'Ex.: Simulado 1', value: sim?.name ?? '' });
    const date = h('input', { id: 'm-date', type: 'date', max: todayKey(), value: sim?.date ?? todayKey() });
    const typeSel = h('select', { id: 'm-type' },
      h('option', { value: 'completo', selected: type === 'completo' }, 'Completo (70 questões, distribuição oficial)'),
      h('option', { value: 'parcial', selected: type === 'parcial' }, 'Parcial (estimativa)'));
    const hours = h('input', { id: 'm-h', type: 'number', min: '0', max: '24', inputmode: 'numeric', placeholder: '0', value: sim?.durationMin != null ? Math.floor(sim.durationMin / 60) : '' });
    const mins = h('input', { id: 'm-m', type: 'number', min: '0', max: '59', inputmode: 'numeric', placeholder: '0', value: sim?.durationMin != null ? sim.durationMin % 60 : '' });
    const notes = h('textarea', { id: 'm-notes' }, sim?.notes ?? '');
    const table = h('div', { class: 'sim-table' });
    const readout = h('p', { class: 'readout', role: 'status' });

    function updateReadout() {
      try {
        const sc = simulationScores(parseSimulationResults(discs, type, draft), discs, type);
        readout.textContent = `Gerais: ${formatGrade(sc.gerais.grade)} | Específicos: ${formatGrade(sc.especificos.grade)} | Nota final estimada: ${sc.final != null ? formatGrade(sc.final) : `sem nota final (faltam questões de ${sc.missing.join(' e ')})`}${sc.estimated ? ' (estimativa)' : ''}`;
      } catch { readout.textContent = type === 'completo' ? 'Preencha os acertos de todas as disciplinas para ver a nota estimada.' : 'Preencha ao menos uma disciplina para ver a nota estimada.'; }
    }

    function drawTable() {
      const head = h('div', { class: 'sim-row sim-head' }, h('span', {}, 'Disciplina'), h('span', {}, 'Questões'), h('span', {}, 'Acertos'));
      table.replaceChildren(head, ...Object.entries(BLOCKS).flatMap(([bk, bname]) => [
        h('div', { class: 'sim-block' }, bname),
        ...discs.filter(d => d.block === bk).map(d => {
          const total = type === 'completo'
            ? h('span', { class: 'sim-fixed' }, String(d.questions))
            : h('input', { type: 'number', min: '1', max: '1000', inputmode: 'numeric', 'aria-label': `Total de questões em ${d.name}`, value: draft[d.id].total, oninput: e => { draft[d.id].total = e.target.value; updateReadout(); } });
          const correct = h('input', { type: 'number', min: '0', max: '1000', inputmode: 'numeric', 'aria-label': `Acertos em ${d.name}`, value: draft[d.id].correct, oninput: e => { draft[d.id].correct = e.target.value; updateReadout(); } });
          return h('div', { class: 'sim-row' }, h('span', { class: 'sim-name' }, d.name), total, correct);
        })
      ]));
      updateReadout();
    }
    typeSel.addEventListener('change', () => { type = typeSel.value; drawTable(); });

    const form = h('form', { novalidate: true, onsubmit: async e => {
      e.preventDefault();
      err.hidden = true;
      try {
        const nm = name.value.trim();
        if (!nm) throw new Error('Informe o nome do simulado.');
        if (!date.value) throw new Error('Informe a data.');
        if (date.value > todayKey()) throw new Error('A data não pode ser futura.');
        const durationMin = parseOptionalDuration(hours.value, mins.value);
        const results = parseSimulationResults(discs, type, draft);
        const data = { name: nm, date: date.value, type, durationMin, results, notes: notes.value.trim(), createdAtMs: sim?.createdAtMs ?? Date.now() };
        if (sim) data.id = sim.id;
        saveBtn.disabled = true;
        const id = await saveSimulation(ctx.user.uid, data);
        const saved = { ...data, id };
        ctx.simulations = sim ? ctx.simulations.map(x => (x.id === id ? saved : x)) : [...ctx.simulations, saved];
        toast(sim ? 'Simulado atualizado' : 'Simulado registrado');
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
        h('div', {}, h('label', { for: 'm-name' }, 'Nome'), name),
        h('div', {}, h('label', { for: 'm-date' }, 'Data'), date),
        h('div', { class: 'wide' }, h('label', { for: 'm-type' }, 'Tipo'), typeSel),
        h('div', {}, h('label', { for: 'm-h' }, 'Duração: horas (opcional)'), hours),
        h('div', {}, h('label', { for: 'm-m' }, 'Duração: minutos (opcional)'), mins)),
      table, readout,
      h('div', { class: 'form-grid' }, h('div', { class: 'wide' }, h('label', { for: 'm-notes' }, 'Observações'), notes)),
      err,
      h('div', { class: 'form-actions' },
        h('button', { type: 'submit', class: 'btn primary', id: 'm-save' }, sim ? 'Salvar alterações' : 'Registrar simulado'),
        sim && h('button', { type: 'button', class: 'btn ghost', onclick: () => { state.editing = null; renderForm(); } }, 'Cancelar')));
    const saveBtn = form.querySelector('#m-save');
    formBox.replaceChildren(h('h2', {}, sim ? 'Editar simulado' : 'Registrar simulado'), form);
    drawTable();
  }

  // ---------- Histórico ----------
  const sorted = () => [...ctx.simulations].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0));

  async function remove(sim) {
    if (!confirm(`Excluir o simulado "${sim.name}" (${formatDateBR(sim.date)})? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteSimulation(ctx.user.uid, sim.id);
      ctx.simulations = ctx.simulations.filter(x => x.id !== sim.id);
      if (state.editing?.id === sim.id) { state.editing = null; renderForm(); }
      toast('Simulado excluído');
      renderList();
    } catch (e) {
      console.error(e);
      toast('Não foi possível excluir. Verifique a conexão.', 'error');
    }
  }

  function renderList() {
    const rows = sorted();
    const withFinal = rows.map(s => ({ s, sc: scoresOf(s) })).filter(x => x.sc.final != null);
    const completos = withFinal.filter(x => x.s.type === 'completo');
    const last = withFinal[0];
    const avg = completos.length ? completos.reduce((n, x) => n + x.sc.final, 0) / completos.length : null;

    summary.replaceChildren(
      statCard('Simulados registrados', rows.length ? String(rows.length) : 'Sem dados'),
      statCard('Última nota estimada', last ? formatGrade(last.sc.final) : 'Sem dados',
        last ? `${last.s.name}, ${formatDateBR(last.s.date)}${last.sc.estimated ? ' (estimativa parcial)' : ''}` : null),
      statCard('Média dos completos', avg != null ? formatGrade(avg) : 'Sem dados', completos.length ? `${completos.length} simulado(s) completo(s)` : 'Só entram simulados completos'));

    const recent = withFinal.slice(0, 8).reverse();
    chartBox.replaceChildren(h('h3', {}, 'Evolução da nota estimada'),
      recent.length
        ? barsVertical(recent.map(x => ({ label: ddmm(x.s.date), sub: x.sc.estimated ? 'parcial' : 'completo', value: x.sc.final, text: formatGrade(x.sc.final) })), 10)
        : h('p', { class: 'muted' }, 'Sem dados. Registre um simulado com questões dos dois blocos.'),
      h('p', { class: 'muted chart-note' }, `Escala de 0 a 10. Notas parciais são estimativas. A nota mínima do edital é ${formatGrade(MIN_GRADE)}.`));

    if (!rows.length) {
      listEl.replaceChildren(h('li', { class: 'empty' }, 'Nenhum simulado registrado ainda. Use o formulário acima.'));
      return;
    }
    listEl.replaceChildren(...rows.map(sim => {
      const sc = scoresOf(sim);
      return h('li', { class: 'session sim-item' },
        h('div', { class: 'session-main' },
          h('div', { class: 'session-top' },
            h('strong', {}, sim.name), h('span', { class: 'chip' }, typeLabel(sim.type)), h('span', { class: 'muted' }, formatDateBR(sim.date)),
            sim.durationMin != null ? h('span', { class: 'muted' }, `Duração: ${formatDuration(sim.durationMin)}`) : null),
          h('div', {}, `Gerais: ${formatGrade(sc.gerais.grade)} (${sc.gerais.correct}/${sc.gerais.total}) | Específicos: ${formatGrade(sc.especificos.grade)} (${sc.especificos.correct}/${sc.especificos.total})`),
          h('div', {}, h('strong', {}, `Nota final estimada: ${finalText(sc)}`), sc.estimated && sc.final != null ? ' (estimativa)' : null),
          sc.final != null ? h('div', { class: 'muted' }, sc.final >= MIN_GRADE ? `Igual ou acima da nota mínima de ${formatGrade(MIN_GRADE)}` : `Abaixo da nota mínima de ${formatGrade(MIN_GRADE)}`) : null,
          h('details', { class: 'sim-details' },
            h('summary', {}, 'Resultado por disciplina'),
            h('ul', { class: 'plain-list' }, discs.filter(d => sim.results[d.id]).map(d => {
              const r = sim.results[d.id];
              return h('li', {}, `${d.name}: ${r.correct}/${r.total} (${formatPercent((r.correct / r.total) * 100)})`);
            }))),
          sim.notes ? h('div', { class: 'muted session-notes' }, sim.notes) : null),
        h('div', { class: 'session-actions' },
          h('button', { class: 'btn ghost', type: 'button', onclick: () => { state.editing = sim; renderForm(); formBox.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, 'Editar'),
          h('button', { class: 'btn ghost danger', type: 'button', onclick: () => remove(sim) }, 'Excluir')));
    }));
  }

  root.replaceChildren(
    h('details', { class: 'card method' }, h('summary', {}, 'Como a nota é estimada'), h('ul', { class: 'plain-list' }, METHOD.map(t => h('li', {}, t)))),
    h('div', { class: 'section-tight' }, formBox),
    h('div', { class: 'section' }, h('h2', {}, 'Histórico de simulados'), h('div', { class: 'section-tight' }, summary), chartBox, h('div', { class: 'section-tight' }, listEl)));
  renderForm();
  renderList();
}
