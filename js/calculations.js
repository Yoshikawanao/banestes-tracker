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
