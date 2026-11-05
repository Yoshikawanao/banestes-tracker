export const ACTIVITIES = [['teoria', 'Teoria'], ['questoes', 'Questões'], ['revisao', 'Revisão'], ['simulado', 'Simulado'], ['leitura', 'Leitura'], ['outros', 'Outros']];
export const actLabel = v => ACTIVITIES.find(a => a[0] === v)?.[1] ?? v;
