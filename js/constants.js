export const ACTIVITIES = [['teoria', 'Teoria'], ['questoes', 'Questões'], ['revisao', 'Revisão'], ['simulado', 'Simulado'], ['leitura', 'Leitura'], ['outros', 'Outros']];
export const actLabel = v => ACTIVITIES.find(a => a[0] === v)?.[1] ?? v;

export const REASONS = [
  ['falta_conhecimento', 'Falta de conhecimento'], ['interpretacao', 'Interpretação'], ['desatencao', 'Desatenção'],
  ['aplicacao', 'Dificuldade de aplicação'], ['esquecimento', 'Esquecimento'], ['outros', 'Outros']
];
export const reasonLabel = v => REASONS.find(r => r[0] === v)?.[1] ?? v;
export const ALTERNATIVES = ['A', 'B', 'C', 'D', 'E'];
export const RATINGS = [['errei', 'Errei'], ['dificil', 'Difícil'], ['bom', 'Bom'], ['facil', 'Fácil']];
