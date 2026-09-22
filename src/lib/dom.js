import { FONT_STACKS } from './model.js';

// Tiny DOM helper. No dependencies, safe inside Shadow DOM.
export function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const key of Object.keys(props)) {
      const value = props[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.slice(0, 2) === 'on' && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  if (children === null || children === undefined || children === false) return node;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function applyFont(node, font) {
  if (!font) return node;
  node.style.fontFamily = FONT_STACKS[font.face] || FONT_STACKS.default;
  node.style.fontSize = (font.size || 9) + 'pt';
  node.style.color = font.color || '#111111';
  node.style.fontWeight = font.bold ? '700' : '400';
  node.style.fontStyle = font.italic ? 'italic' : 'normal';
  node.style.textDecoration = font.underline ? 'underline' : 'none';
  return node;
}
