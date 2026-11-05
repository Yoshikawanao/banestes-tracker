// Rode com: node tests/calculations.test.mjs
import assert from 'node:assert/strict';
import { flattenLeaves, countLeaves, percent, coverage, hitRate, blockGrade, finalGrade, goalCompliance, formatPercent } from '../js/calculations.js';
import { toLocalDateKey, formatDateBR, parseDuration, formatDuration, sumMinutes, distinctDays, weekRange, sessionsInRange } from '../js/calculations.js';

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
console.log('Todos os testes passaram.');
