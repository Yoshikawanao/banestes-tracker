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
