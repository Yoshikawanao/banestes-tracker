// Rode com: node tests/calculations.test.mjs
import assert from 'node:assert/strict';
import { flattenLeaves, countLeaves, percent, coverage, hitRate, blockGrade, finalGrade, goalCompliance, formatPercent } from '../js/calculations.js';

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
console.log('Todos os testes passaram.');
