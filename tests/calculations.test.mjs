// Rode com: node tests/calculations.test.mjs
import assert from 'node:assert/strict';
import { flattenLeaves, countLeaves, percent, coverage, hitRate, blockGrade, finalGrade, goalCompliance, formatPercent } from '../js/calculations.js';
import { toLocalDateKey, formatDateBR, parseDuration, formatDuration, sumMinutes, distinctDays, weekRange, sessionsInRange } from '../js/calculations.js';
import { elapsedMs, pauseTimer, resumeTimer, msToMinutes, formatClock } from '../js/calculations.js';
import { parseQuestionCounts, summarizeQuestions } from '../js/calculations.js';
import { monthRange, lastNWeeks, minutesByDay, intensityLevel, monthMatrix, shiftMonth, averagePerStudyDay, minutesByKey, weeklyHitRates } from '../js/calculations.js';

const tree = [
  { id: 'a', title: 'A', children: [{ id: 'a1', title: 'A1' }, { id: 'a2', title: 'A2' }] },
  { id: 'b', title: 'B' }
];
assert.equal(countLeaves(tree), 3);
assert.deepEqual(flattenLeaves(tree).map(l => l.id), ['a1', 'a2', 'b']);
assert.equal(percent(0, 0), null);
assert.equal(formatPercent(null), 'Sem dados');
assert.equal(formatPercent(50), '50%');

const prog = { a1: { theory: 'concluido' }, b: { theory: 'em_andamento' } };
const c = coverage(tree, prog, 'theory', 'concluido');
assert.equal(c.done, 1); assert.equal(c.total, 3);
assert.ok(Math.abs(c.percent - 33.333) < 0.01);
assert.equal(coverage([], {}, 'theory', 'concluido').percent, null);

assert.equal(hitRate(0, 0), null);
assert.equal(hitRate(7, 10), 70);
assert.throws(() => hitRate(11, 10), RangeError);

assert.equal(finalGrade(7, 8).toFixed(2), '7.67');           // exemplo do roteiro
assert.equal(blockGrade(21, 30), 7);
assert.equal(blockGrade(32, 40), 8);
assert.equal(finalGrade(blockGrade(21, 30), blockGrade(32, 40)).toFixed(2), '7.67');
assert.equal(goalCompliance(12, 10), 120);                  // não limitar a 100%
assert.equal(goalCompliance(5, 0), null);


// ---------- Sessões ----------

assert.equal(toLocalDateKey(new Date(2026, 10, 5)), '2026-11-05');
assert.equal(formatDateBR('2026-11-05'), '05/11/2026');
assert.equal(parseDuration('1', '30'), 90);
assert.equal(parseDuration('', '45'), 45);
assert.equal(parseDuration(2, ''), 120);
assert.throws(() => parseDuration('', ''), /maior que zero/);
assert.throws(() => parseDuration(0, 60), /entre 0 e 59/);
assert.throws(() => parseDuration(-1, 10));
assert.throws(() => parseDuration(1.5, 0));
assert.throws(() => parseDuration(25, 0), /24 horas/);
assert.equal(formatDuration(90), '1h30');
assert.equal(formatDuration(45), '45min');
assert.equal(formatDuration(120), '2h');
assert.equal(formatDuration(65), '1h05');

const ss = [
  { date: '2026-11-02', minutes: 60 }, { date: '2026-11-02', minutes: 30 },
  { date: '2026-11-05', minutes: 45 }, { date: '2026-11-09', minutes: 20 }
];
assert.equal(sumMinutes(ss), 155);
assert.equal(distinctDays(ss), 3);
assert.deepEqual(weekRange('2026-11-05'), ['2026-11-02', '2026-11-08']);   // quinta -> semana seg-dom
assert.deepEqual(weekRange('2026-11-08'), ['2026-11-02', '2026-11-08']);   // domingo fecha a semana
assert.deepEqual(weekRange('2026-11-09'), ['2026-11-09', '2026-11-15']);
assert.equal(sessionsInRange(ss, '2026-11-02', '2026-11-08').length, 3);
assert.equal(sumMinutes([]), 0);

// ---------- Cronômetro ----------
const MIN = 60000;
let tm = { status: 'running', accumulatedMs: 0, lastResumeMs: 0, startedAtMs: 0 };
assert.equal(elapsedMs(tm, 10 * MIN), 10 * MIN);
tm = pauseTimer(tm, 10 * MIN);                       // pausa aos 10 min
assert.equal(tm.status, 'paused');
assert.equal(elapsedMs(tm, 30 * MIN), 10 * MIN);     // pausa não conta
tm = resumeTimer(tm, 30 * MIN);                      // volta aos 30 min
assert.equal(elapsedMs(tm, 35 * MIN), 15 * MIN);     // 10 + 5
assert.equal(pauseTimer(pauseTimer(tm, 40 * MIN), 50 * MIN).accumulatedMs, 20 * MIN); // pausar de novo não duplica
assert.equal(resumeTimer(tm, 99 * MIN), tm);          // retomar quem já roda não muda nada
assert.equal(elapsedMs({ status: 'running', accumulatedMs: 0, lastResumeMs: 5000 }, 1000), 0); // relógio nunca negativo
assert.equal(msToMinutes(29999), 0);
assert.equal(msToMinutes(30000), 1);
assert.equal(msToMinutes(90 * MIN), 90);
assert.equal(formatClock(3725000), '01:02:05');
assert.equal(formatClock(0), '00:00:00');

// ---------- Questões ----------
assert.deepEqual(parseQuestionCounts('20', '14'), { total: 20, correct: 14, wrong: 6 });
assert.deepEqual(parseQuestionCounts(10, 0), { total: 10, correct: 0, wrong: 10 });   // zero acertos é válido
assert.throws(() => parseQuestionCounts('', '3'), /total de questões/);
assert.throws(() => parseQuestionCounts('10', ''), /número de acertos/);
assert.throws(() => parseQuestionCounts('10', '11'), /não podem ser maiores/);
assert.throws(() => parseQuestionCounts('0', '0'), /pelo menos 1/);
assert.throws(() => parseQuestionCounts('10.5', '3'), /inteiros/);
assert.throws(() => parseQuestionCounts('10', '-1'), /inteiros/);
assert.throws(() => parseQuestionCounts('1001', '3'), /1000/);
const qs = summarizeQuestions([{ total: 20, correct: 14 }, { total: 10, correct: 6 }]);
assert.deepEqual(qs, { total: 30, correct: 20, wrong: 10, rate: (20 / 30) * 100 });
assert.equal(summarizeQuestions([]).rate, null);                                      // sem registros: Sem dados, não 0%
assert.equal(formatPercent(summarizeQuestions([{ total: 5, correct: 0 }]).rate), '0%'); // 0 acertos com questões feitas é 0% real

// ---------- Dashboard e calendário ----------
assert.deepEqual(monthRange('2026-11-05'), ['2026-11-01', '2026-11-30']);
assert.deepEqual(monthRange('2028-02-10'), ['2028-02-01', '2028-02-29']);          // ano bissexto
assert.deepEqual(lastNWeeks('2026-11-05', 3), [['2026-10-19', '2026-10-25'], ['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08']]);
assert.equal(lastNWeeks('2026-11-05', 8).length, 8);
assert.equal(intensityLevel(0), 0); assert.equal(intensityLevel(1), 1); assert.equal(intensityLevel(29), 1);
assert.equal(intensityLevel(30), 2); assert.equal(intensityLevel(59), 2); assert.equal(intensityLevel(60), 3);
assert.equal(intensityLevel(119), 3); assert.equal(intensityLevel(120), 4);
assert.equal(minutesByDay(ss).get('2026-11-02'), 90);
const nov = monthMatrix(2026, 10);                                                  // novembro/2026 começa no domingo
assert.equal(nov.length, 6);
assert.equal(nov[0].filter(Boolean).length, 1);
assert.equal(nov[0][6], '2026-11-01');
assert.equal(nov[5][0], '2026-11-30');
assert.equal(nov.flat().filter(Boolean).length, 30);
assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, month0: 11 });
assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, month0: 0 });
assert.equal(averagePerStudyDay([]), null);
assert.ok(Math.abs(averagePerStudyDay(ss) - 155 / 3) < 1e-9);
const byDisc = minutesByKey([{ disciplineId: 'a', minutes: 10 }, { disciplineId: 'b', minutes: 5 }, { disciplineId: 'a', minutes: 20 }], s => s.disciplineId);
assert.equal(byDisc.get('a'), 30); assert.equal(byDisc.get('b'), 5);
const wr = weeklyHitRates([{ date: '2026-11-03', total: 10, correct: 7 }, { date: '2026-10-28', total: 5, correct: 5 }], [['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08'], ['2026-11-09', '2026-11-15']]);
assert.equal(wr[0].rate, 100); assert.equal(wr[1].rate, 70); assert.equal(wr[1].total, 10);
assert.equal(wr[2].rate, null);                                                    // semana sem questões: Sem dados
console.log('Todos os testes passaram.');
