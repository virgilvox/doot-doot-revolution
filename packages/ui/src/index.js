// ui: the arcade candy design tokens as CSS plus small shared primitives. This
// is a rendering-support package, so it may build DOM helpers, but it holds no
// game logic.

import { css } from './css.js';
import { tokens, DIFF_VAR } from './tokens.js';

export { css, tokens, DIFF_VAR };

const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap';

// Inject the stylesheet into a document once. Returns the <style> element.
export function mountCss(doc = document, id = 'ddr-css') {
  let el = doc.getElementById(id);
  if (!el) {
    el = doc.createElement('style');
    el.id = id;
    doc.head.appendChild(el);
  }
  el.textContent = css;
  return el;
}

// Add the Baloo 2 + Outfit web fonts if they are not already linked.
export function mountFonts(doc = document) {
  if (doc.querySelector('link[data-ddr-fonts]')) return;
  const pre1 = doc.createElement('link'); pre1.rel = 'preconnect'; pre1.href = 'https://fonts.googleapis.com';
  const pre2 = doc.createElement('link'); pre2.rel = 'preconnect'; pre2.href = 'https://fonts.gstatic.com'; pre2.crossOrigin = 'anonymous';
  const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = FONTS_HREF; link.setAttribute('data-ddr-fonts', '');
  doc.head.appendChild(pre1); doc.head.appendChild(pre2); doc.head.appendChild(link);
}

// Escape a string for safe insertion into innerHTML.
export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
