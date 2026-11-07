// Regras de recomendação. Funções puras: recebem os dados e devolvem sugestões, sempre com justificativa.
import {
  flattenLeaves, cardStatus, daysBetween, summarizeQuestions, groupQuestions, sampleStatus, formatPercent, formatDuration,
  formatDateBR, weekRange, addDays, sessionsInRange, minutesByKey, MIN_SAMPLE, ATTENTION_RATE
} from './calculations.js';

export const RANKS = { revisoes: 1, desempenho: 2, metas: 3, dedicacao: 4, exercicios: 5, novos: 6 };
export const DEDICATION_WINDOW_DAYS = 30;
export const DEDICATION_MIN_MINUTES = 300;   // abaixo disso não há dados para falar de distribuição
export const OLD_MISTAKE_DAYS = 3;

// Quanto cada disciplina vale na nota final: Gerais pesa 1 e Específicos pesa 2, cada bloco de 0 a 10.
export const gradeShare = (d, discs) => {
  const blockTotal = discs.filter(x => x.block === d.block).reduce((n, x) => n + x.questions, 0);
  return (d.block === 'gerais' ? 1 / 3 : 2 / 3) * (d.questions / blockTotal);
};

const plural = (n, one, many) => (n === 1 ? one : many);
const dd = key => formatDateBR(key).slice(0, 5);

export function buildRecommendations({ discs, progress = {}, sessions = [], questions = [], flashcards = [], mistakes = [], goals = {}, today }) {
  const recs = [];
  const add = (kind, severity, title, reason, link) => recs.push({ kind, rank: RANKS[kind], severity, title, reason, link });
  const pct = x => formatPercent(x * 100);

  // 1) Revisões atrasadas
  const pending = flashcards.filter(c => cardStatus(c, today) === 'pendente');
  if (pending.length) {
    const overdue = pending.filter(c => daysBetween(today, c.dueDate) < 0);
    const oldest = overdue.length ? Math.max(...overdue.map(c => -daysBetween(today, c.dueDate))) : 0;
    add('revisoes', pending.length + oldest, `Revisar ${pending.length} ${plural(pending.length, 'flashcard', 'flashcards')}`,
      `${pending.length} ${plural(pending.length, 'cartão vence', 'cartões vencem')} hoje ou já passou da data${oldest ? `; o mais atrasado está há ${oldest} ${plural(oldest, 'dia', 'dias')} sem revisão` : ''}. Revisar no prazo evita esquecer o conteúdo.`,
      '#/revisoes');
  }
  const oldMistakes = mistakes.filter(m => m.status === 'pendente' && daysBetween(m.date, today) >= OLD_MISTAKE_DAYS);
  if (oldMistakes.length) {
    const oldest = oldMistakes.map(m => m.date).sort()[0];
    add('revisoes', oldMistakes.length, `Revisar ${oldMistakes.length} ${plural(oldMistakes.length, 'erro', 'erros')} do caderno`,
      `${oldMistakes.length} ${plural(oldMistakes.length, 'erro registrado', 'erros registrados')} há ${OLD_MISTAKE_DAYS} dias ou mais continuam sem revisão (o mais antigo é de ${formatDateBR(oldest)}). Erros não revisados tendem a se repetir.`,
      '#/revisoes');
  }

  // 2) Aproveitamento baixo com amostra suficiente
  const byDisc = groupQuestions(questions, q => q.disciplineId);
  for (const d of discs) {
    const s = byDisc.get(d.id);
    if (s && sampleStatus(s) === 'atencao') {
      add('desempenho', ATTENTION_RATE - s.rate, `Reforçar ${d.name}`,
        `Aproveitamento de ${formatPercent(s.rate)} em ${s.total} questões, abaixo da referência de ${ATTENTION_RATE}% (amostra mínima: ${MIN_SAMPLE} questões).`, '#/desempenho');
    }
  }

  // 3) Metas não cumpridas na última semana completa
  const [thisStart] = weekRange(today);
  const lastEnd = addDays(thisStart, -1);
  const lastStart = addDays(thisStart, -7);
  const hasHistory = sessions.some(s => s.date <= lastEnd) || questions.some(q => q.date <= lastEnd);
  if (hasHistory) {
    const lastSessions = sessionsInRange(sessions, lastStart, lastEnd);
    const range = `${dd(lastStart)} a ${dd(lastEnd)}`;
    if (goals.weeklyMinutes) {
      const real = lastSessions.reduce((n, s) => n + (s.minutes || 0), 0);
      if (real < goals.weeklyMinutes) {
        add('metas', 1 - real / goals.weeklyMinutes, 'Retomar a meta semanal de horas',
          `Na semana de ${range} você estudou ${formatDuration(real)} de ${formatDuration(goals.weeklyMinutes)} (${formatPercent((real / goals.weeklyMinutes) * 100)}).`, '#/planejamento/metas');
      }
    }
    if (goals.weeklyQuestions) {
      const real = sessionsInRange(questions, lastStart, lastEnd).reduce((n, q) => n + (q.total || 0), 0);
      if (real < goals.weeklyQuestions) {
        add('metas', 1 - real / goals.weeklyQuestions, 'Retomar a meta semanal de questões',
          `Na semana de ${range} você resolveu ${real} de ${goals.weeklyQuestions} questões (${formatPercent((real / goals.weeklyQuestions) * 100)}).`, '#/planejamento/metas');
      }
    }
    const minByDisc = minutesByKey(lastSessions, s => s.disciplineId);
    const missed = discs.filter(d => goals.perDiscipline?.[d.id] && (minByDisc.get(d.id) || 0) < goals.perDiscipline[d.id])
      .map(d => ({ d, real: minByDisc.get(d.id) || 0, goal: goals.perDiscipline[d.id] }))
      .sort((a, b) => a.real / a.goal - b.real / b.goal);
    if (missed.length) {
      add('metas', 0.5, 'Metas por disciplina não cumpridas',
        `Na semana de ${range}: ${missed.slice(0, 3).map(x => `${x.d.name} (${formatDuration(x.real)} de ${formatDuration(x.goal)})`).join('; ')}${missed.length > 3 ? ` e mais ${missed.length - 3}` : ''}.`, '#/planejamento/metas');
    }
  }

  // 4) Disciplinas com pouca dedicação, em relação ao peso na nota
  const recent = sessionsInRange(sessions, addDays(today, -(DEDICATION_WINDOW_DAYS - 1)), today);
  const recentTotal = recent.reduce((n, s) => n + (s.minutes || 0), 0);
  if (recentTotal >= DEDICATION_MIN_MINUTES) {
    const mins = minutesByKey(recent, s => s.disciplineId);
    for (const d of discs) {
      const expected = gradeShare(d, discs);
      const actual = (mins.get(d.id) || 0) / recentTotal;
      if (expected >= 0.05 && actual < expected * 0.5) {
        add('dedicacao', expected - actual, `Dedicar mais tempo a ${d.name}`,
          `Vale ${pct(expected)} da nota, mas recebeu ${pct(actual)} do seu tempo nos últimos ${DEDICATION_WINDOW_DAYS} dias.`, '#/estudos');
      }
    }
  }

  // 5) Teoria sem exercícios  e  6) Assuntos ainda não estudados
  const studiedTopics = new Set(sessions.map(s => s.topicId).filter(Boolean));
  const fresh = [];
  for (const d of discs) {
    const leaves = flattenLeaves(d.topics);
    if (!leaves.length) continue;
    const st = l => progress[l.id] ?? {};
    const noEx = leaves.filter(l => st(l).theory === 'concluido' && (st(l).exercises ?? 'nao_iniciado') === 'nao_iniciado');
    if (noEx.length) {
      add('exercicios', noEx.length, `Fazer exercícios de ${d.name}`,
        `${noEx.length} ${plural(noEx.length, 'assunto tem', 'assuntos têm')} teoria concluída e nenhum exercício iniciado (ex.: ${noEx[0].title.length > 70 ? `${noEx[0].title.slice(0, 69)}…` : noEx[0].title}). Teoria concluída não significa domínio.`,
        '#/desempenho');
    }
    const untouched = leaves.filter(l => (st(l).theory ?? 'nao_iniciado') === 'nao_iniciado' && (st(l).exercises ?? 'nao_iniciado') === 'nao_iniciado' && !studiedTopics.has(l.id));
    if (untouched.length) fresh.push({ d, n: untouched.length, total: leaves.length, severity: gradeShare(d, discs) * (untouched.length / leaves.length), example: untouched[0].title });
  }
  fresh.sort((a, b) => b.severity - a.severity).slice(0, 3).forEach(f => add('novos', f.severity, `Começar assuntos novos de ${f.d.name}`,
    `${f.n} de ${f.total} assuntos ainda não foram estudados, e a disciplina vale ${pct(gradeShare(f.d, discs))} da nota (ex.: ${f.example.length > 70 ? `${f.example.slice(0, 69)}…` : f.example}).`, '#/edital'));

  return recs.sort((a, b) => a.rank - b.rank || b.severity - a.severity);
}
