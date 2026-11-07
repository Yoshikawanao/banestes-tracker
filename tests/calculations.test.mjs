// Rode com: node tests/calculations.test.mjs
import assert from 'node:assert/strict';
import { flattenLeaves, countLeaves, percent, coverage, hitRate, blockGrade, finalGrade, goalCompliance, formatPercent } from '../js/calculations.js';
import { toLocalDateKey, formatDateBR, parseDuration, formatDuration, sumMinutes, distinctDays, weekRange, sessionsInRange } from '../js/calculations.js';
import { elapsedMs, pauseTimer, resumeTimer, msToMinutes, formatClock } from '../js/calculations.js';
import { parseQuestionCounts, summarizeQuestions } from '../js/calculations.js';
import { monthRange, lastNWeeks, minutesByDay, intensityLevel, monthMatrix, shiftMonth, averagePerStudyDay, minutesByKey, weeklyHitRates } from '../js/calculations.js';
import { MIN_SAMPLE, ATTENTION_RATE, addDays, periodRange, comparisonRanges, groupQuestions, sampleStatus, marginOfError, rateDifference, formatPoints, formatMargin } from '../js/calculations.js';
import { MIN_GRADE, roundEdital, formatGrade, parseOptionalDuration, parseSimulationResults, simulationScores } from '../js/calculations.js';

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

// ---------- Análise de desempenho ----------
assert.equal(addDays('2026-11-05', -6), '2026-10-30');
assert.equal(addDays('2026-03-01', -1), '2026-02-28');
assert.deepEqual(periodRange('all', '2026-11-05'), [null, null]);
assert.deepEqual(periodRange('7d', '2026-11-05'), ['2026-10-30', '2026-11-05']);   // 7 dias incluindo hoje
assert.deepEqual(periodRange('30d', '2026-11-05'), ['2026-10-07', '2026-11-05']);
assert.deepEqual(periodRange('month', '2026-11-05'), ['2026-11-01', '2026-11-05']);
assert.deepEqual(comparisonRanges('7d', '2026-11-05'), { current: ['2026-10-30', '2026-11-05'], previous: ['2026-10-23', '2026-10-29'] });
assert.deepEqual(comparisonRanges('30d', '2026-11-05'), { current: ['2026-10-07', '2026-11-05'], previous: ['2026-09-07', '2026-10-06'] });
assert.deepEqual(comparisonRanges('month', '2026-11-05'), { current: ['2026-11-01', '2026-11-05'], previous: ['2026-10-01', '2026-10-05'] });
assert.deepEqual(comparisonRanges('month', '2026-03-31'), { current: ['2026-03-01', '2026-03-31'], previous: ['2026-02-01', '2026-02-28'] }); // fevereiro mais curto
const g = groupQuestions([{ d: 'a', total: 10, correct: 5 }, { d: 'a', total: 10, correct: 9 }, { d: 'b', total: 4, correct: 4 }], r => r.d);
assert.equal(g.get('a').total, 20); assert.equal(g.get('a').rate, 70); assert.equal(g.get('b').rate, 100);
assert.equal(MIN_SAMPLE, 20); assert.equal(ATTENTION_RATE, 60);
assert.equal(sampleStatus({ total: 0, rate: null }), 'sem_dados');
assert.equal(sampleStatus({ total: 19, rate: 10 }), 'pequena');       // poucas questões: sem conclusão, mesmo com taxa baixa
assert.equal(sampleStatus({ total: 20, rate: 59.9 }), 'atencao');
assert.equal(sampleStatus({ total: 20, rate: 60 }), 'ok');
assert.equal(marginOfError(0, 0), null);
assert.ok(marginOfError(0, 10) > 0);                                  // não zera nos extremos
assert.ok(marginOfError(70, 100) < marginOfError(7, 10));              // mais questões, menos incerteza
assert.equal(rateDifference({ total: 0, rate: null }, { total: 30, rate: 70 }).diff, null);
assert.deepEqual(rateDifference({ total: 30, rate: 80 }, { total: 25, rate: 70 }), { diff: 10, enough: true });
assert.equal(rateDifference({ total: 30, rate: 80 }, { total: 5, rate: 60 }).enough, false);
assert.equal(formatPoints(10), '+10,0 p.p.');
assert.equal(formatPoints(-2.54), '-2,5 p.p.');
assert.equal(formatMargin(9.04), '±9,0 p.p.');

// ---------- Simulados ----------
import fs from 'node:fs';
import { NEW_CARD, scheduleCard, daysBetween, intervalLabel, cardStatus, dueLabel, countBy, validateCardInput, validateMistakeInput } from '../js/calculations.js';
const editalData = JSON.parse(fs.readFileSync(new URL('../data/edital.json', import.meta.url), 'utf8'));
const DISCS = editalData.disciplines;
assert.equal(DISCS.reduce((n, d) => n + d.questions, 0), 70);                       // distribuição oficial: 70 questões
assert.equal(DISCS.filter(d => d.block === 'gerais').reduce((n, d) => n + d.questions, 0), 30);
assert.equal(DISCS.filter(d => d.block === 'especificos').reduce((n, d) => n + d.questions, 0), 40);
assert.equal(MIN_GRADE, 6);
assert.equal(roundEdital(7.665), 7.67);       // terceira casa 5: para cima
assert.equal(roundEdital(7.664), 7.66);
assert.equal(roundEdital(6.995), 7);
assert.equal(roundEdital(23 / 3), 7.67);
assert.equal(roundEdital(6), 6);
assert.equal(formatGrade(7.67), '7,67');
assert.equal(formatGrade(6), '6,00');
assert.equal(formatGrade(null), 'Sem dados');
assert.equal(parseOptionalDuration('', ''), null);
assert.equal(parseOptionalDuration('3', '30'), 210);
assert.throws(() => parseOptionalDuration('0', '0'), /maior que zero/);

// completo: Gerais 21/30 = 7,0 e Específicos 32/40 = 8,0 -> 7,67 (exemplo do roteiro)
const full = { lp: 7, mrlq: 7, amf: 4, ecesg: 3, cb: 12, mf: 4, pe: 4, inf: 4, vna: 8 };               // gerais 21, específicos 32
const inputsFull = Object.fromEntries(Object.entries(full).map(([k, v]) => [k, { correct: String(v) }]));
const resFull = parseSimulationResults(DISCS, 'completo', inputsFull);
assert.equal(resFull.cb.total, 15);                                                  // total fixo oficial
const scFull = simulationScores(resFull, DISCS, 'completo');
assert.equal(scFull.gerais.grade, 7); assert.equal(scFull.especificos.grade, 8);
assert.equal(scFull.final, 7.67); assert.equal(scFull.estimated, false);
assert.throws(() => parseSimulationResults(DISCS, 'completo', { ...inputsFull, lp: { correct: '11' } }), /não podem passar de 10/);
assert.throws(() => parseSimulationResults(DISCS, 'completo', { ...inputsFull, cb: { correct: '' } }), /Conhecimentos Bancários/);
assert.throws(() => parseSimulationResults(DISCS, 'completo', {}), /Informe os acertos/);

// parcial: só Gerais -> sem nota final; os dois blocos -> estimativa
const resG = parseSimulationResults(DISCS, 'parcial', { lp: { total: '10', correct: '5' } });
const scG = simulationScores(resG, DISCS, 'parcial');
assert.equal(scG.gerais.grade, 5); assert.equal(scG.final, null); assert.deepEqual(scG.missing, ['Conhecimentos Específicos']); assert.equal(scG.estimated, true);
const resP = parseSimulationResults(DISCS, 'parcial', { lp: { total: '10', correct: '5' }, cb: { total: '10', correct: '8' } });
assert.equal(simulationScores(resP, DISCS, 'parcial').final, 7);                     // (5 + 2*8) / 3
assert.throws(() => parseSimulationResults(DISCS, 'parcial', {}), /ao menos uma disciplina/);
assert.throws(() => parseSimulationResults(DISCS, 'parcial', { lp: { total: '10', correct: '12' } }), /Língua Portuguesa/);
assert.throws(() => parseSimulationResults(DISCS, 'parcial', { lp: { total: '10', correct: '' } }), /acertos/);

// ---------- Revisões ----------
const T = '2026-11-05';
let card = { ...NEW_CARD, dueDate: T };
card = { ...card, ...scheduleCard(card, 'bom', T) };
assert.equal(card.intervalDays, 1); assert.equal(card.reps, 1); assert.equal(card.dueDate, '2026-11-06');
card = { ...card, ...scheduleCard(card, 'bom', '2026-11-06') };
assert.equal(card.intervalDays, 3); assert.equal(card.dueDate, '2026-11-09');
card = { ...card, ...scheduleCard(card, 'bom', '2026-11-09') };
assert.equal(card.intervalDays, 8);                                                  // 3 x 2,5 = 7,5 -> 8
const lapsed = scheduleCard(card, 'errei', '2026-11-17');
assert.equal(lapsed.intervalDays, 1); assert.equal(lapsed.reps, 0); assert.equal(lapsed.lapses, 1); assert.equal(lapsed.ease, 2.3);
assert.equal(lapsed.dueDate, '2026-11-18');
assert.equal(scheduleCard(NEW_CARD, 'facil', T).intervalDays, 3);
assert.equal(scheduleCard(NEW_CARD, 'facil', T).ease, 2.65);
assert.equal(scheduleCard(NEW_CARD, 'dificil', T).intervalDays, 1);
assert.equal(scheduleCard({ ...NEW_CARD, reps: 3, intervalDays: 10 }, 'dificil', T).intervalDays, 12);
assert.ok(scheduleCard({ ...NEW_CARD, reps: 3, intervalDays: 10 }, 'bom', T).intervalDays > 10);   // nunca encurta ao acertar
assert.equal(scheduleCard({ ...NEW_CARD, reps: 5, intervalDays: 170, ease: 2.5 }, 'facil', T).intervalDays, 180); // teto
let hard = { ...NEW_CARD }; for (let i = 0; i < 20; i++) hard = { ...hard, ...scheduleCard(hard, 'errei', T) };
assert.equal(hard.ease, 1.3);                                                     // facilidade nunca cai abaixo de 1,3
assert.throws(() => scheduleCard(NEW_CARD, 'xyz', T), /inválida/);
assert.equal(daysBetween('2026-11-05', '2026-11-08'), 3);
assert.equal(daysBetween('2026-11-05', '2026-11-04'), -1);
assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);                          // virada do horário de verão não distorce
assert.equal(intervalLabel(1), 'amanhã'); assert.equal(intervalLabel(8), '8 dias');
assert.equal(intervalLabel(30), '1 mês'); assert.equal(intervalLabel(90), '3 meses');
assert.equal(cardStatus({ dueDate: '2026-11-04' }, T), 'pendente');               // atrasado
assert.equal(cardStatus({ dueDate: '2026-11-05' }, T), 'pendente');               // vence hoje
assert.equal(cardStatus({ dueDate: '2026-11-08' }, T), 'proximo');
assert.equal(cardStatus({ dueDate: '2026-11-09' }, T), 'futuro');
assert.equal(dueLabel({ dueDate: '2026-11-03' }, T), 'Atrasado há 2 dias');
assert.equal(dueLabel({ dueDate: '2026-11-04' }, T), 'Atrasado há 1 dia');
assert.equal(dueLabel({ dueDate: '2026-11-05' }, T), 'Vence hoje');
assert.equal(dueLabel({ dueDate: '2026-11-06' }, T), 'Vence amanhã');
assert.equal(dueLabel({ dueDate: '2026-11-12' }, T), 'Vence em 7 dias');
const cnt = countBy([{ r: 'a' }, { r: 'b' }, { r: 'a' }], x => x.r);
assert.equal(cnt.get('a'), 2); assert.equal(cnt.get('b'), 1);
assert.throws(() => validateCardInput({ disciplineId: '', front: 'p', back: 'r' }), /disciplina/);
assert.throws(() => validateCardInput({ disciplineId: 'lp', front: '  ', back: 'r' }), /pergunta/);
assert.throws(() => validateCardInput({ disciplineId: 'lp', front: 'p', back: '' }), /resposta/);
validateCardInput({ disciplineId: 'lp', front: 'p', back: 'r' });
const okM = { date: T, disciplineId: 'lp', statement: 'texto', chosen: 'A', correct: 'C', reason: 'desatencao' };
validateMistakeInput(okM, T);
assert.throws(() => validateMistakeInput({ ...okM, chosen: 'C' }, T), /não é um erro/);
assert.throws(() => validateMistakeInput({ ...okM, date: '2026-11-06' }, T), /futura/);
assert.throws(() => validateMistakeInput({ ...okM, statement: ' ' }, T), /enunciado/);
assert.throws(() => validateMistakeInput({ ...okM, reason: '' }, T), /motivo/);
assert.throws(() => validateMistakeInput({ ...okM, correct: '' }, T), /resposta correta/);
console.log('Todos os testes passaram.');
