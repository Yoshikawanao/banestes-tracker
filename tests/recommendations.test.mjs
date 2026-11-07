// Rode com: node tests/recommendations.test.mjs
import assert from 'node:assert/strict';
import { buildRecommendations, gradeShare } from '../js/recommendations.js';

const discs = [
  { id: 'a', name: 'Disc A', block: 'gerais', questions: 30, topics: [{ id: 'a1', title: 'A1' }, { id: 'a2', title: 'A2' }, { id: 'a3', title: 'A3' }] },
  { id: 'b', name: 'Disc B', block: 'especificos', questions: 40, topics: [{ id: 'b1', title: 'B1' }, { id: 'b2', title: 'B2' }] }
];
const T = '2026-11-05';                                 // quinta; semana de 02/11, semana passada 26/10 a 01/11
const base = { discs, today: T };
const kinds = r => r.map(x => x.kind);

assert.ok(Math.abs(gradeShare(discs[0], discs) - 1 / 3) < 1e-9);
assert.ok(Math.abs(gradeShare(discs[1], discs) - 2 / 3) < 1e-9);

// sem nenhum dado de estudo: só aparece "assuntos novos" (edital existe), nada inventado
const empty = buildRecommendations(base);
assert.deepEqual([...new Set(kinds(empty))], ['novos']);
assert.ok(empty.every(r => r.reason.length > 10 && r.title && r.link));     // toda sugestão tem justificativa
assert.deepEqual(buildRecommendations({ discs: [{ ...discs[0], topics: [] }], today: T }), []);

// flashcards atrasados
const late = buildRecommendations({ ...base, flashcards: [{ dueDate: '2026-11-02' }, { dueDate: '2026-11-05' }, { dueDate: '2026-11-20' }] });
const rev = late.find(r => r.kind === 'revisoes');
assert.match(rev.title, /2 flashcards/); assert.match(rev.reason, /3 dias/);
assert.equal(buildRecommendations({ ...base, flashcards: [{ dueDate: '2026-11-20' }] }).some(r => r.kind === 'revisoes'), false);

// erros antigos sem revisão
const mk = buildRecommendations({ ...base, mistakes: [{ status: 'pendente', date: '2026-11-01' }, { status: 'pendente', date: '2026-11-04' }, { status: 'revisado', date: '2026-10-01' }] });
assert.match(mk.find(r => r.kind === 'revisoes').title, /1 erro do caderno/);

// aproveitamento baixo: precisa de amostra mínima (20)
const q20 = [{ date: '2026-11-01', disciplineId: 'a', total: 20, correct: 10 }];
const q19 = [{ date: '2026-11-01', disciplineId: 'a', total: 19, correct: 5 }];
assert.match(buildRecommendations({ ...base, questions: q20 }).find(r => r.kind === 'desempenho').reason, /50%.*20 questões/);
assert.equal(buildRecommendations({ ...base, questions: q19 }).some(r => r.kind === 'desempenho'), false);   // amostra pequena: sem conclusão
assert.equal(buildRecommendations({ ...base, questions: [{ date: '2026-11-01', disciplineId: 'a', total: 20, correct: 12 }] }).some(r => r.kind === 'desempenho'), false); // 60% não é abaixo

// teoria sem exercícios
const th = buildRecommendations({ ...base, progress: { a1: { theory: 'concluido' }, a2: { theory: 'concluido', exercises: 'em_andamento' } } });
assert.match(th.find(r => r.kind === 'exercicios').reason, /1 assunto tem teoria concluída/);

// assuntos novos: tópico com sessão registrada não conta como não estudado
const ses = [{ date: '2026-11-04', disciplineId: 'b', topicId: 'b1', minutes: 30 }];
const nv = buildRecommendations({ ...base, sessions: ses });
assert.match(nv.find(r => r.kind === 'novos' && /Disc B/.test(r.title)).reason, /1 de 2 assuntos/);

// metas não cumpridas na semana passada
const goals = { weeklyMinutes: 600 };
const lastWeek = [{ date: '2026-10-28', disciplineId: 'a', topicId: null, minutes: 120 }];
const mg = buildRecommendations({ ...base, sessions: lastWeek, goals });
assert.match(mg.find(r => r.kind === 'metas').reason, /2h de 10h \(20%\)/);
assert.equal(buildRecommendations({ ...base, sessions: [{ date: '2026-10-28', minutes: 600 }], goals }).some(r => r.kind === 'metas'), false); // meta cumprida
assert.equal(buildRecommendations({ ...base, sessions: [{ date: '2026-11-03', minutes: 30 }], goals }).some(r => r.kind === 'metas'), false);    // sem histórico anterior: não cobra
const gq = buildRecommendations({ ...base, sessions: lastWeek, goals: { weeklyQuestions: 50 }, questions: [{ date: '2026-10-29', disciplineId: 'a', total: 10, correct: 8 }] });
assert.match(gq.find(r => r.kind === 'metas').reason, /10 de 50 questões \(20%\)/);
const gd = buildRecommendations({ ...base, sessions: lastWeek, goals: { perDiscipline: { a: 60, b: 120 } } });
assert.match(gd.find(r => r.kind === 'metas').reason, /Disc B \(0min de 2h\)/);
assert.doesNotMatch(gd.find(r => r.kind === 'metas').reason, /Disc A/);          // A cumpriu 120 >= 60

// pouca dedicação: B vale 67% da nota e recebeu 0% do tempo; poucos dados não disparam
const heavyA = [{ date: '2026-10-20', disciplineId: 'a', topicId: null, minutes: 400 }];
assert.match(buildRecommendations({ ...base, sessions: heavyA }).find(r => r.kind === 'dedicacao').reason, /Vale 67% da nota.*0% do seu tempo/);
assert.equal(buildRecommendations({ ...base, sessions: [{ date: '2026-10-20', disciplineId: 'a', minutes: 200 }] }).some(r => r.kind === 'dedicacao'), false);
assert.equal(buildRecommendations({ ...base, sessions: [{ date: '2026-08-01', disciplineId: 'a', minutes: 900 }] }).some(r => r.kind === 'dedicacao'), false); // fora da janela de 30 dias

// ordem por prioridade: revisões, desempenho, metas, dedicação, exercícios, novos
const all = buildRecommendations({ ...base, flashcards: [{ dueDate: '2026-11-01' }], questions: q20, sessions: [...lastWeek, ...heavyA], goals,
  progress: { b1: { theory: 'concluido' } } });
const order = kinds(all);
assert.deepEqual([...new Set(order)], ['revisoes', 'desempenho', 'metas', 'dedicacao', 'exercicios', 'novos']);
console.log('Recomendações: todos os testes passaram.');
