import { h, shorten, statCard } from './ui.js';
import {
  flattenLeaves, formatPercent, formatDateBR, todayKey, summarizeQuestions, groupQuestions, sampleStatus,
  marginOfError, formatMargin, formatPoints, rateDifference, periodRange, comparisonRanges, lastNWeeks,
  weeklyHitRates, sessionsInRange, MIN_SAMPLE, ATTENTION_RATE
} from './calculations.js';
import { barsVertical } from './charts.js';

const PERIODS = [['all', 'Todo o período'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['month', 'Este mês']];
const COMPARES = [['7d', 'Últimos 7 dias × 7 dias anteriores'], ['30d', 'Últimos 30 dias × 30 dias anteriores'], ['month', 'Este mês × mesmo período do mês anterior']];
const BLOCKS = { gerais: 'Conhecimentos Gerais', especificos: 'Conhecimentos Específicos' };
const STATUS_TEXT = {
  pequena: `Amostra pequena (menos de ${MIN_SAMPLE} questões): sem conclusão`,
  atencao: `Precisa de atenção (abaixo de ${ATTENTION_RATE}%)`
};

const ddmm = key => formatDateBR(key).slice(0, 5);
const rangeText = ([a, b]) => `${ddmm(a)} a ${ddmm(b)}`;

function rateRow(label, s) {
  const st = sampleStatus(s);
  return h('div', { class: 'rate-row' },
    h('div', { class: 'rate-top' },
      h('span', { class: 'rate-label' }, label),
      h('span', { class: 'rate-val' }, s.total ? `${formatPercent(s.rate)} (${s.correct}/${s.total})` : 'Sem dados')),
    h('div', { class: 'hbar-track', role: 'presentation' },
      s.total ? h('div', { class: st === 'atencao' ? 'hbar-fill warn' : 'hbar-fill', style: `width:${Math.max(2, s.rate)}%` }) : null),
    h('div', { class: 'rate-tags' },
      h('span', { class: 'chip' }, `n=${s.total}`),
      STATUS_TEXT[st] ? h('span', { class: st === 'atencao' ? 'chip mid' : 'chip' }, STATUS_TEXT[st]) : null));
}

const section = (title, ...content) => h('div', { class: 'section' }, h('h2', {}, title), ...content);
const select = (id, label, options, value, onchange) => h('div', {},
  h('label', { for: id }, label),
  h('select', { id, onchange: e => onchange(e.target.value) },
    options.map(([v, l]) => h('option', { value: v, selected: v === value }, l))));

export function renderAnalysis(root, ctx) {
  const today = todayKey();
  const discs = ctx.edital.disciplines;
  const state = { period: 'all', topicDisc: 'all', evoDisc: 'all', cmp: '30d' };
  const discName = id => discs.find(d => d.id === id)?.name ?? id;
  const topicInfo = new Map(discs.flatMap(d => flattenLeaves(d.topics).map(t => [t.id, { title: t.title, discId: d.id }])));

  const inRange = (rows, [from, to]) => rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to));

  function draw() {
    const rows = inRange(ctx.questions, periodRange(state.period, today));
    const all = summarizeQuestions(rows);
    const moe = marginOfError(all.correct, all.total);
    const byDisc = groupQuestions(rows, r => r.disciplineId);
    const empty = { total: 0, correct: 0, wrong: 0, rate: null };
    const discSummary = d => byDisc.get(d.id) ?? empty;

    // ---- geral ----
    const general = h('div', { class: 'grid' },
      statCard('Questões resolvidas', all.total ? String(all.total) : 'Sem dados', all.total ? `${rows.length} registro(s)` : null),
      statCard('Acertos', all.total ? String(all.correct) : 'Sem dados'),
      statCard('Erros', all.total ? String(all.wrong) : 'Sem dados'),
      statCard('Taxa de acertos', formatPercent(all.rate),
        all.total ? `n=${all.total}, margem de erro aproximada ${formatMargin(moe)}` : null));

    // ---- por disciplina ----
    const discBlocks = Object.entries(BLOCKS).flatMap(([bk, bname]) => [
      h('h3', { class: 'block-title' }, bname),
      ...discs.filter(d => d.block === bk).map(d => rateRow(d.name, discSummary(d)))
    ]);

    // ---- por assunto ----
    const byTopic = groupQuestions(rows.filter(r => r.topicId && (state.topicDisc === 'all' || r.disciplineId === state.topicDisc)), r => r.topicId);
    const topicRows = [...byTopic].sort(([, a], [, b]) => {
      const sa = a.total >= MIN_SAMPLE; const sb = b.total >= MIN_SAMPLE;
      return sa !== sb ? (sa ? -1 : 1) : sa ? a.rate - b.rate : b.total - a.total;
    });
    const noTopic = rows.filter(r => !r.topicId).reduce((n, r) => n + r.total, 0);
    const topicList = topicRows.length
      ? topicRows.map(([id, s]) => rateRow(shorten(topicInfo.get(id)?.title ?? id, 110), s))
      : [h('div', { class: 'empty' }, 'Nenhum assunto com questões registradas neste filtro.')];

    // ---- atenção ----
    const withData = discs.map(d => [d, discSummary(d)]).filter(([, s]) => s.total);
    const attention = withData.filter(([, s]) => sampleStatus(s) === 'atencao').sort((a, b) => a[1].rate - b[1].rate);
    const small = withData.filter(([, s]) => sampleStatus(s) === 'pequena');
    const none = discs.filter(d => !discSummary(d).total);
    const attentionBox = h('div', { class: 'card' },
      attention.length
        ? h('ul', { class: 'plain-list' }, attention.map(([d, s]) => h('li', {}, h('strong', {}, d.name), `: ${formatPercent(s.rate)} em ${s.total} questões (abaixo de ${ATTENTION_RATE}%).`)))
        : h('p', {}, `Nenhuma disciplina com pelo menos ${MIN_SAMPLE} questões e aproveitamento abaixo de ${ATTENTION_RATE}%.`),
      small.length ? h('p', { class: 'muted' }, `Sem conclusão por amostra pequena: ${small.map(([d, s]) => `${d.name} (n=${s.total})`).join('; ')}.`) : null,
      none.length ? h('p', { class: 'muted' }, `Sem questões registradas: ${none.map(d => d.name).join('; ')}.`) : null);

    // ---- evolução ----
    const weeks = lastNWeeks(today, 8);
    const evoRows = ctx.questions.filter(r => state.evoDisc === 'all' || r.disciplineId === state.evoDisc);
    const rates = weeklyHitRates(evoRows, weeks);
    const evo = rates.some(w => w.total)
      ? barsVertical(rates.map(w => ({ label: ddmm(w.from), sub: w.total ? `n=${w.total}` : null, value: w.rate, text: w.total ? formatPercent(w.rate) : '-' })), 100)
      : h('p', { class: 'muted' }, 'Sem dados nas últimas 8 semanas.');

    // ---- comparação ----
    const { current, previous } = comparisonRanges(state.cmp, today);
    const cur = summarizeQuestions(inRange(ctx.questions, current));
    const prev = summarizeQuestions(inRange(ctx.questions, previous));
    const diff = rateDifference(cur, prev);
    const periodCard = (title, range, s) => h('div', { class: 'card' },
      h('div', { class: 'label' }, `${title} (${rangeText(range)})`),
      h('div', { class: 'value' }, formatPercent(s.rate)),
      h('div', { class: 'sub' }, s.total ? `${s.correct} acertos em ${s.total} questões` : 'Sem questões neste período'));
    const compareText = diff.diff == null
      ? 'Sem dados em um dos períodos: não dá para comparar.'
      : `Diferença: ${formatPoints(diff.diff)}.${diff.enough ? '' : ` Amostra pequena (menos de ${MIN_SAMPLE} questões em pelo menos um período): não tire conclusões.`}`;

    root.replaceChildren(
      h('div', { class: 'card' },
        h('div', { class: 'form-grid' }, select('a-period', 'Período da análise', PERIODS, state.period, v => { state.period = v; draw(); })),
        h('p', { class: 'muted note' }, `Com menos de ${MIN_SAMPLE} questões, os números aparecem, mas sem classificação. O aproveitamento de referência para atenção é ${ATTENTION_RATE}% (a nota mínima do edital é 6,00).`)),
      section('Aproveitamento geral', general),
      section('Por disciplina', h('div', { class: 'card rate-list' }, discBlocks)),
      section('Por assunto',
        h('div', { class: 'form-grid' }, select('a-topic-disc', 'Disciplina', [['all', 'Todas as disciplinas'], ...discs.map(d => [d.id, d.name])], state.topicDisc, v => { state.topicDisc = v; draw(); })),
        h('div', { class: 'card rate-list' }, topicList),
        noTopic ? h('p', { class: 'muted note' }, `${noTopic} questões foram registradas sem assunto específico e não aparecem nesta lista.`) : null),
      section('Disciplinas que precisam de atenção', attentionBox),
      section('Evolução semanal',
        h('div', { class: 'form-grid' }, select('a-evo', 'Disciplina', [['all', 'Todas as disciplinas'], ...discs.map(d => [d.id, d.name])], state.evoDisc, v => { state.evoDisc = v; draw(); })),
        h('div', { class: 'card' }, evo, h('p', { class: 'muted chart-note' }, 'n é o número de questões da semana. Semanas com poucas questões oscilam muito.'))),
      section('Comparação entre períodos',
        h('div', { class: 'form-grid' }, select('a-cmp', 'Comparar', COMPARES, state.cmp, v => { state.cmp = v; draw(); })),
        h('div', { class: 'grid' }, periodCard('Período atual', current, cur), periodCard('Período anterior', previous, prev)),
        h('p', { class: 'note' }, compareText)));
  }
  draw();
}
