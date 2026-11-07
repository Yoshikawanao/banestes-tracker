// Cálculos puros e reutilizáveis (sem acesso a Firebase nem ao DOM). Testados em tests/.

export const isLeaf = t => !t.children || t.children.length === 0;

export function flattenLeaves(topics) {
  const out = [];
  for (const t of topics || []) {
    if (isLeaf(t)) out.push(t);
    else out.push(...flattenLeaves(t.children));
  }
  return out;
}

export const countLeaves = topics => flattenLeaves(topics).length;

// Retorna null quando não há base de cálculo ("Sem dados"), nunca 0%.
export const percent = (done, total) => (total > 0 ? (done / total) * 100 : null);

// Cobertura do edital: conta apenas os tópicos finais (folhas) da hierarquia.
export function coverage(topics, progress, field, doneValue) {
  const leaves = flattenLeaves(topics);
  const done = leaves.filter(l => progress?.[l.id]?.[field] === doneValue).length;
  return { done, total: leaves.length, percent: percent(done, leaves.length) };
}

export function hitRate(acertos, total) {
  if (!(total > 0)) return null;
  if (acertos < 0 || acertos > total) throw new RangeError('Acertos fora do intervalo válido.');
  return (acertos / total) * 100;
}

export const blockGrade = (acertos, total) => (acertos / total) * 10;

// Nota final = (G + 2 × E) / 3, com G e E já normalizados de 0 a 10.
export const finalGrade = (g, e) => (g + 2 * e) / 3;

// Cumprimento de meta: não limitado a 100%.
export const goalCompliance = (realizado, planejado) => (planejado > 0 ? (realizado / planejado) * 100 : null);

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
export const formatPercent = p => (p == null ? 'Sem dados' : `${nf.format(p)}%`);

// ---------- Sessões de estudo ----------

const pad = n => String(n).padStart(2, '0');

// Data local (não UTC) no formato AAAA-MM-DD.
export const toLocalDateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => toLocalDateKey(new Date());

export function formatDateBR(key) {
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

// Converte horas + minutos digitados em minutos. Lança Error com mensagem em pt-BR se inválido.
export function parseDuration(hours, minutes) {
  const h = hours === '' || hours == null ? 0 : Number(hours);
  const m = minutes === '' || minutes == null ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) throw new Error('Informe horas e minutos com números inteiros.');
  if (m > 59) throw new Error('Os minutos devem ficar entre 0 e 59.');
  const total = h * 60 + m;
  if (total <= 0) throw new Error('A duração deve ser maior que zero.');
  if (total > 24 * 60) throw new Error('A duração máxima por sessão é de 24 horas.');
  return total;
}

export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h${pad(m)}`;
}

export const sumMinutes = sessions => sessions.reduce((n, s) => n + (s.minutes || 0), 0);

// Dias estudados: datas locais distintas com sessões registradas.
export const distinctDays = sessions => new Set(sessions.map(s => s.date)).size;

// Semana de segunda a domingo que contém a data informada.
export function weekRange(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  const start = toLocalDateKey(dt);
  dt.setDate(dt.getDate() + 6);
  return [start, toLocalDateKey(dt)];
}

export function sessionsInRange(sessions, from, to) {
  return sessions.filter(s => (!from || s.date >= from) && (!to || s.date <= to));
}

// ---------- Cronômetro ----------
// O tempo é sempre calculado a partir de timestamps persistidos (nunca de um contador em memória):
// tempo = acumulado das partes já encerradas + (agora - último retorno), só se estiver rodando.

export const elapsedMs = (t, now) =>
  (t.accumulatedMs || 0) + (t.status === 'running' && t.lastResumeMs != null ? Math.max(0, now - t.lastResumeMs) : 0);

export const pauseTimer = (t, now) =>
  (t.status === 'running' ? { ...t, status: 'paused', accumulatedMs: elapsedMs(t, now), lastResumeMs: null } : t);

export const resumeTimer = (t, now) =>
  (t.status === 'paused' ? { ...t, status: 'running', lastResumeMs: now } : t);

export const msToMinutes = ms => Math.round(ms / 60000);

export function formatClock(ms) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

// ---------- Questões ----------

// Valida total e acertos digitados. Lança Error com mensagem em pt-BR se inválido.
export function parseQuestionCounts(total, correct) {
  if (total === '' || total == null) throw new Error('Informe o total de questões.');
  if (correct === '' || correct == null) throw new Error('Informe o número de acertos (use 0 se errou todas).');
  const t = Number(total);
  const c = Number(correct);
  if (!Number.isInteger(t) || !Number.isInteger(c) || t < 0 || c < 0) throw new Error('Use apenas números inteiros.');
  if (t < 1) throw new Error('O total de questões deve ser pelo menos 1.');
  if (t > 1000) throw new Error('O total por registro pode ter no máximo 1000 questões.');
  if (c > t) throw new Error('Os acertos não podem ser maiores que o total de questões.');
  return { total: t, correct: c, wrong: t - c };
}

// Soma uma lista de registros. rate é null ("Sem dados") quando não há questões.
export function summarizeQuestions(rows) {
  const total = rows.reduce((n, r) => n + (r.total || 0), 0);
  const correct = rows.reduce((n, r) => n + (r.correct || 0), 0);
  return { total, correct, wrong: total - correct, rate: hitRate(correct, total) };
}

// ---------- Dashboard e calendário ----------

const keyToDate = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };

export function monthRange(key) {
  const d = keyToDate(key);
  return [toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), 1)), toLocalDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}

// Últimas n semanas (segunda a domingo), da mais antiga para a atual.
export function lastNWeeks(key, n) {
  const [start] = weekRange(key);
  const base = keyToDate(start);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7 * (n - 1 - i));
    return weekRange(toLocalDateKey(d));
  });
}

export function minutesByDay(sessions) {
  const map = new Map();
  for (const s of sessions) map.set(s.date, (map.get(s.date) || 0) + (s.minutes || 0));
  return map;
}

// Intensidade do calendário (volume de estudo no dia, não qualidade).
export const intensityLevel = min => (min >= 120 ? 4 : min >= 60 ? 3 : min >= 30 ? 2 : min > 0 ? 1 : 0);

// Semanas (segunda a domingo) de um mês; dias fora do mês ficam null. month0: 0 a 11.
export function monthMatrix(year, month0) {
  const offset = (new Date(year, month0, 1).getDay() + 6) % 7;
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => toLocalDateKey(new Date(year, month0, i + 1)))];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export function shiftMonth(year, month0, delta) {
  const d = new Date(year, month0 + delta, 1);
  return { year: d.getFullYear(), month0: d.getMonth() };
}

// Média por dia estudado (dias com ao menos uma sessão). null quando não há sessões.
export function averagePerStudyDay(sessions) {
  const days = distinctDays(sessions);
  return days ? sumMinutes(sessions) / days : null;
}

export function minutesByKey(sessions, keyFn) {
  const map = new Map();
  for (const s of sessions) { const k = keyFn(s); map.set(k, (map.get(k) || 0) + (s.minutes || 0)); }
  return map;
}

// Aproveitamento por semana, com o tamanho da amostra de cada uma.
export function weeklyHitRates(questions, ranges) {
  return ranges.map(([from, to]) => {
    const rows = questions.filter(q => q.date >= from && q.date <= to);
    return { from, to, ...summarizeQuestions(rows) };
  });
}

// ---------- Análise de desempenho ----------

export const MIN_SAMPLE = 20;       // abaixo disso, mostramos os números mas não classificamos
export const ATTENTION_RATE = 60;   // referência de atenção (a nota mínima do edital é 6,00)

export function addDays(key, n) {
  const d = keyToDate(key);
  return toLocalDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

// Período de análise. 'all' devolve [null, null] (sem limite).
export function periodRange(kind, today) {
  if (kind === '7d') return [addDays(today, -6), today];
  if (kind === '30d') return [addDays(today, -29), today];
  if (kind === 'month') return [monthRange(today)[0], today];
  return [null, null];
}

// Período atual e o período anterior equivalente, para comparação justa.
export function comparisonRanges(kind, today) {
  if (kind === '7d') return { current: [addDays(today, -6), today], previous: [addDays(today, -13), addDays(today, -7)] };
  if (kind === '30d') return { current: [addDays(today, -29), today], previous: [addDays(today, -59), addDays(today, -30)] };
  const [start] = monthRange(today);
  const elapsed = Number(today.slice(8));
  const prevStart = monthRange(addDays(start, -1))[0];
  const prevMonthEnd = addDays(start, -1);
  const prevEnd = addDays(prevStart, elapsed - 1);
  return { current: [start, today], previous: [prevStart, prevEnd > prevMonthEnd ? prevMonthEnd : prevEnd] };
}

export function groupQuestions(rows, keyFn) {
  const groups = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return new Map([...groups].map(([k, v]) => [k, summarizeQuestions(v)]));
}

// 'sem_dados' | 'pequena' | 'atencao' | 'ok'
export function sampleStatus(s) {
  if (!s.total) return 'sem_dados';
  if (s.total < MIN_SAMPLE) return 'pequena';
  return s.rate < ATTENTION_RATE ? 'atencao' : 'ok';
}

// Margem de erro aproximada (pontos percentuais, 95%), ajustada para não zerar em 0% ou 100%.
export function marginOfError(correct, total) {
  if (!total) return null;
  const n = total + 4;
  const p = (correct + 2) / n;
  return 1.96 * Math.sqrt((p * (1 - p)) / n) * 100;
}

export function rateDifference(cur, prev) {
  if (!cur.total || !prev.total) return { diff: null, enough: false };
  return { diff: cur.rate - prev.rate, enough: cur.total >= MIN_SAMPLE && prev.total >= MIN_SAMPLE };
}

const nf1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
export const formatPoints = d => `${d > 0 ? '+' : ''}${nf1.format(d)} p.p.`;
export const formatMargin = m => `±${nf1.format(m)} p.p.`;

// ---------- Simulados ----------

export const MIN_GRADE = 6; // nota mínima do edital (média ponderada)

// Edital, item 14.2: duas casas decimais; terceira casa >= 5 arredonda para cima.
export const roundEdital = x => Math.floor(x * 100 + 0.5 + 1e-9) / 100;

const nf2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatGrade = x => (x == null ? 'Sem dados' : nf2.format(x));

// Duração opcional: vazio vira null; preenchido segue as regras de parseDuration.
export function parseOptionalDuration(hours, minutes) {
  const blank = v => v === '' || v == null;
  return blank(hours) && blank(minutes) ? null : parseDuration(hours, minutes);
}

// Valida os resultados digitados. discs: [{ id, name, block, questions }].
// Completo: distribuição oficial (total fixo por disciplina, acertos obrigatórios em todas).
// Parcial: só as disciplinas preenchidas, com total e acertos.
export function parseSimulationResults(discs, type, inputs) {
  const blank = v => v === '' || v == null;
  const results = {};
  for (const d of discs) {
    const inp = inputs[d.id] || {};
    if (type === 'completo') {
      if (blank(inp.correct)) throw new Error(`Informe os acertos em ${d.name} (use 0 se errou todas).`);
      const c = Number(inp.correct);
      if (!Number.isInteger(c) || c < 0) throw new Error(`${d.name}: use apenas números inteiros.`);
      if (c > d.questions) throw new Error(`${d.name}: os acertos não podem passar de ${d.questions}.`);
      results[d.id] = { total: d.questions, correct: c };
    } else {
      if (blank(inp.total) && blank(inp.correct)) continue;
      try {
        const p = parseQuestionCounts(inp.total, inp.correct);
        results[d.id] = { total: p.total, correct: p.correct };
      } catch (e) { throw new Error(`${d.name}: ${e.message}`); }
    }
  }
  if (!Object.keys(results).length) throw new Error('Preencha ao menos uma disciplina.');
  return results;
}

// Notas por bloco (0 a 10) e nota final estimada. A nota final só existe com questões dos dois blocos.
export function simulationScores(results, discs, type) {
  const blocks = { gerais: { total: 0, correct: 0 }, especificos: { total: 0, correct: 0 } };
  for (const d of discs) {
    const r = results[d.id];
    if (r && blocks[d.block]) { blocks[d.block].total += r.total; blocks[d.block].correct += r.correct; }
  }
  const grade = b => (b.total > 0 ? (b.correct / b.total) * 10 : null);
  const g = grade(blocks.gerais);
  const e = grade(blocks.especificos);
  const raw = g != null && e != null ? finalGrade(g, e) : null;
  const wrap = (b, v) => ({ ...b, grade: v == null ? null : roundEdital(v) });
  return {
    gerais: wrap(blocks.gerais, g),
    especificos: wrap(blocks.especificos, e),
    final: raw == null ? null : roundEdital(raw),
    estimated: type !== 'completo',
    missing: [g == null && 'Conhecimentos Gerais', e == null && 'Conhecimentos Específicos'].filter(Boolean)
  };
}

// ---------- Revisões: caderno de erros e flashcards ----------

export const NEW_CARD = { ease: 2.5, reps: 0, lapses: 0, intervalDays: 0 };
const MAX_INTERVAL = 180;
const round2 = x => Math.round(x * 100) / 100;

// Agendamento de revisão (inspirado no SM-2). rating: 'errei' | 'dificil' | 'bom' | 'facil'.
// Retorna os novos campos do cartão; a data da próxima revisão é hoje + intervalo.
export function scheduleCard(card, rating, today) {
  const ease0 = card.ease ?? NEW_CARD.ease;
  const reps0 = card.reps ?? 0;
  const prev = card.intervalDays ?? 0;
  let ease = ease0, reps = reps0, lapses = card.lapses ?? 0, interval;
  if (rating === 'errei') {
    reps = 0; lapses += 1; ease = Math.max(1.3, ease0 - 0.2); interval = 1;
  } else if (rating === 'dificil') {
    ease = Math.max(1.3, ease0 - 0.15); reps += 1;
    interval = reps0 === 0 ? 1 : Math.max(prev + 1, Math.round(prev * 1.2));
  } else if (rating === 'bom') {
    reps += 1;
    interval = reps0 === 0 ? 1 : reps0 === 1 ? 3 : Math.max(prev + 1, Math.round(prev * ease0));
  } else if (rating === 'facil') {
    ease = ease0 + 0.15; reps += 1;
    interval = reps0 === 0 ? 3 : reps0 === 1 ? 6 : Math.max(prev + 1, Math.round(prev * ease0 * 1.3));
  } else throw new Error('Avaliação inválida.');
  interval = Math.min(MAX_INTERVAL, interval);
  return { ease: round2(ease), reps, lapses, intervalDays: interval, dueDate: addDays(today, interval) };
}

export const daysBetween = (fromKey, toKey) => Math.round((keyToDate(toKey) - keyToDate(fromKey)) / 86400000);

export function intervalLabel(days) {
  if (days === 1) return 'amanhã';
  if (days < 30) return `${days} dias`;
  const m = Math.round(days / 30);
  return m === 1 ? '1 mês' : `${m} meses`;
}

// 'pendente' (vence hoje ou atrasado) | 'proximo' (vence em 1 a 3 dias) | 'futuro'
export function cardStatus(card, today) {
  const d = daysBetween(today, card.dueDate);
  return d <= 0 ? 'pendente' : d <= 3 ? 'proximo' : 'futuro';
}

export function dueLabel(card, today) {
  const d = daysBetween(today, card.dueDate);
  if (d < 0) return `Atrasado há ${-d} dia${d === -1 ? '' : 's'}`;
  if (d === 0) return 'Vence hoje';
  return d === 1 ? 'Vence amanhã' : `Vence em ${d} dias`;
}

export function countBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) { const k = keyFn(r); map.set(k, (map.get(k) || 0) + 1); }
  return map;
}

export function validateCardInput({ disciplineId, front, back }) {
  if (!disciplineId) throw new Error('Selecione a disciplina.');
  if (!front.trim()) throw new Error('Escreva a pergunta.');
  if (!back.trim()) throw new Error('Escreva a resposta.');
  if (front.length > 1000 || back.length > 1000) throw new Error('Pergunta e resposta podem ter no máximo 1000 caracteres.');
}

export function validateMistakeInput({ date, disciplineId, statement, chosen, correct, reason }, today) {
  if (!date) throw new Error('Informe a data.');
  if (date > today) throw new Error('A data não pode ser futura.');
  if (!disciplineId) throw new Error('Selecione a disciplina.');
  if (!statement.trim()) throw new Error('Escreva o enunciado ou um resumo da questão.');
  if (statement.length > 1500) throw new Error('O enunciado pode ter no máximo 1500 caracteres.');
  if (!chosen) throw new Error('Selecione a resposta que você escolheu.');
  if (!correct) throw new Error('Selecione a resposta correta.');
  if (chosen === correct) throw new Error('A resposta escolhida e a correta são iguais: isso não é um erro.');
  if (!reason) throw new Error('Selecione o motivo do erro.');
}

// ---------- Planejamento e metas ----------

export const DAY_NAMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

// Horas digitadas (aceita decimais) -> minutos. Vazio = sem meta (null).
export function parseHours(value, maxHours) {
  if (value === '' || value == null) return null;
  const h = Number(value);
  if (!Number.isFinite(h) || h < 0) throw new Error('Informe um número válido de horas.');
  if (h === 0) throw new Error('A meta deve ser maior que zero (deixe em branco para não ter meta).');
  if (h > maxHours) throw new Error(`O máximo permitido é ${maxHours} horas.`);
  return Math.round(h * 60);
}

export function parseCount(value, max) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error('Informe um número inteiro maior que zero (ou deixe em branco).');
  if (n > max) throw new Error(`O máximo permitido é ${max}.`);
  return n;
}

// As 7 datas (segunda a domingo) da semana que começa em weekStart.
export const weekdayKeys = weekStart => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

// Valida o plano semanal. days: 7 listas de { disciplineId, minutes }. Blocos totalmente vazios são ignorados.
export function parsePlan(days) {
  const out = {};
  days.forEach((blocks, i) => {
    const list = [];
    for (const b of blocks) {
      const blankMin = b.minutes === '' || b.minutes == null;
      if (!b.disciplineId && blankMin) continue;
      if (!b.disciplineId) throw new Error(`${DAY_NAMES[i]}: selecione a disciplina do bloco.`);
      const m = Number(b.minutes);
      if (blankMin || !Number.isInteger(m) || m < 5) throw new Error(`${DAY_NAMES[i]}: informe os minutos do bloco (inteiro, no mínimo 5).`);
      if (m > 720) throw new Error(`${DAY_NAMES[i]}: um bloco pode ter no máximo 720 minutos.`);
      list.push({ disciplineId: b.disciplineId, minutes: m });
    }
    if (list.length > 10) throw new Error(`${DAY_NAMES[i]}: no máximo 10 blocos por dia.`);
    if (list.reduce((n, b) => n + b.minutes, 0) > 1440) throw new Error(`${DAY_NAMES[i]}: o total do dia passa de 24 horas.`);
    out[i] = list;
  });
  return out;
}

export const plannedDayMinutes = blocks => (blocks || []).reduce((n, b) => n + b.minutes, 0);

// Minutos planejados por disciplina na semana (plano recorrente).
export function plannedByDiscipline(planDays) {
  const map = new Map();
  for (const blocks of Object.values(planDays || {})) for (const b of blocks) map.set(b.disciplineId, (map.get(b.disciplineId) || 0) + b.minutes);
  return map;
}
