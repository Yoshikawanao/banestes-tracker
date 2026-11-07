// Pedaços de formulário reutilizados nas telas.
import { h, shorten } from './ui.js';
import { flattenLeaves } from './calculations.js';

export const discOptions = (discs, selected, placeholder) => [
  h('option', { value: placeholder[0] }, placeholder[1]),
  ...discs.map(d => h('option', { value: d.id, selected: d.id === selected }, d.name))
];

export const topicOptionsFor = (discs, discId, first, selected) => [
  h('option', { value: first[0] }, first[1]),
  ...flattenLeaves(discs.find(d => d.id === discId)?.topics ?? []).map(t => h('option', { value: t.id, selected: t.id === selected }, shorten(t.title)))
];

export const topicTitleOf = (discs, discId, topicId) =>
  flattenLeaves(discs.find(d => d.id === discId)?.topics ?? []).find(t => t.id === topicId)?.title ?? '';

export const discNameOf = (discs, id) => discs.find(d => d.id === id)?.name ?? id;
