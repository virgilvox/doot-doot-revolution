// Small DOM and format helpers shared by the screens. Only screens and app.js
// touch the DOM; logic lives in the packages.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const on = (el, ev, fn, opt) => el && el.addEventListener(ev, fn, opt);
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function fmtTime(sec) { sec = Math.max(0, sec | 0); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
export function fmtScore(n) { return String(Math.max(0, Math.round(n))).padStart(8, '0'); }

let _tt;
export function toast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show'); clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 1600);
}

// Cover gradient helpers, so wheel cards, banners, and library rows share a look.
export const COVERS = ['--pink', '--purple', '--blue', '--teal', '--green', '--orange', '--red', '--yellow'];
export const covGrad = (i) => `linear-gradient(135deg,var(${COVERS[i % COVERS.length]}),var(${COVERS[(i + 3) % COVERS.length]}))`;
