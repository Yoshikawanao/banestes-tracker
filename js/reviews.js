import { h } from './ui.js';
import { renderReviewHome } from './reviewhome.js';
import { renderMistakes } from './mistakes.js';
import { renderFlashcards } from './flashcards.js';

const TABS = [['revisar', 'Revisar', renderReviewHome], ['erros', 'Caderno de erros', renderMistakes], ['cartoes', 'Flashcards', renderFlashcards]];
let tab = 'revisar';

export function renderReviews(root, ctx) {
  const content = h('div');
  const tabs = h('div', { class: 'tabs', role: 'tablist' });
  const show = id => {
    tab = id;
    tabs.replaceChildren(...TABS.map(([k, label]) =>
      h('button', { type: 'button', role: 'tab', class: k === tab ? 'tab active' : 'tab', 'aria-selected': k === tab ? 'true' : 'false', onclick: () => show(k) }, label)));
    TABS.find(t => t[0] === tab)[2](content, ctx, show);
  };
  root.replaceChildren(
    h('div', { class: 'page-head' }, h('h1', {}, 'Revisões'),
      h('p', {}, 'Revise seus erros e fixe o conteúdo com flashcards de repetição espaçada.')),
    tabs, content);
  show(tab);
}
