// Utilitários de interface (sem dependências).
export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (['value', 'checked', 'selected', 'open', 'hidden'].includes(k)) node[k] = v;
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

let toastTimer;
export function toast(message, kind = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast ${kind}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 5000 : 1800);
}

export function shorten(text, max = 90) {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function statCard(label, value, sub) {
  return h('div', { class: 'card' },
    h('div', { class: 'label' }, label),
    h('div', { class: 'value' }, value),
    sub && h('div', { class: 'sub' }, sub));
}
