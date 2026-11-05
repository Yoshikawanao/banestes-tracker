// Gráficos simples em HTML/CSS (sem biblioteca externa). Todo valor aparece também em texto.
import { h } from './ui.js';

// Colunas verticais. items: [{ label, sub?, value: número|null, text }]. max: valor que ocupa 100% da altura.
export function barsVertical(items, max) {
  const top = max ?? Math.max(1, ...items.map(i => i.value ?? 0));
  return h('div', { class: 'vbars' }, items.map(i => h('div', { class: 'vbar' },
    h('div', { class: 'vbar-val' }, i.text),
    h('div', { class: 'vbar-track' },
      i.value ? h('div', { class: 'vbar-fill', style: `height:${Math.max(3, (i.value / top) * 100)}%` }) : null),
    h('div', { class: 'vbar-label' }, i.label),
    i.sub && h('div', { class: 'vbar-sub' }, i.sub))));
}

// Barras horizontais. items: [{ label, bars: [{ name?, pct: 0-100|null, text }] }]
export function barsHorizontal(items) {
  return h('div', { class: 'hbars' }, items.map(i => h('div', { class: 'hbar-row' },
    h('div', { class: 'hbar-label' }, i.label),
    i.bars.map(b => h('div', { class: b.name ? 'hbar-line named' : 'hbar-line' },
      b.name && h('span', { class: 'hbar-name' }, b.name),
      h('div', { class: 'hbar-track', role: 'presentation' },
        b.pct ? h('div', { class: 'hbar-fill', style: `width:${Math.min(100, Math.max(2, b.pct))}%` }) : null),
      h('span', { class: 'hbar-text' }, b.text))))));
}

// Barra única dividida em partes. parts: [{ label, value, text }]
export function stacked(parts) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return h('div', {},
    h('div', { class: 'stack', role: 'presentation' },
      parts.map((p, i) => (p.value ? h('div', { class: `stack-part p${i}`, style: `width:${(p.value / total) * 100}%` }) : null))),
    h('ul', { class: 'stack-legend' }, parts.map((p, i) => h('li', {}, h('span', { class: `swatch p${i}` }), `${p.label}: ${p.text}`))));
}
