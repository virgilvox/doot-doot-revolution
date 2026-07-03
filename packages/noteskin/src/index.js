// noteskin: the StepMania arrow silhouette and its coloring, drawn to a 2D canvas
// or returned as an SVG string. One geometry, reused everywhere (menus, the
// notefield, the editor) so arrows look identical across the app.
//
// Colors follow the Dance Dance Revolution "Note" scheme of tinting a note by its
// rhythmic quantization: 4th red, 8th blue, 12th green, 16th gold (24th and 32nd
// kept distinct for readability). This is by beat, not by lane. Directions are
// tinted per lane only for menu specimens.

const ARO = '#101018';
const SIL = "M 256 22 L 484 248 L 484 305 L 438 345 L 373 345 L 337 306 L 337 412 L 256 481 L 175 412 L 175 306 L 139 345 L 74 345 L 28 305 L 28 248 Z";
const DET = [
  "M 256 99 L 415 248 L 417 275 L 392 277 L 300 205 L 256 169 L 212 205 L 120 277 L 95 275 L 97 248 Z",
  "M 256 185 L 286 213 L 284 289 L 262 272 L 256 272 L 250 272 L 228 289 L 226 213 Z",
  "M 256 289 L 285 309 L 284 382 L 256 404 L 228 382 L 227 309 Z"
];

// Note tint by rhythmic quantization, following the Dance Dance Revolution "Note"
// scheme: 4th red, 8th blue, 12th (triplet) green, 16th gold. The finer 24th and
// 32nd are kept distinct (purple, orange) for readability on hard charts.
export const QUANT = {
  4: { t: '#C42133', b: '#FF7A6B' },
  8: { t: '#1E3FA8', b: '#57BDF5' },
  12: { t: '#1F9A34', b: '#86EE72' },
  16: { t: '#E0A200', b: '#FFD84D' },
  24: { t: '#6A24C8', b: '#C58BFF' },
  32: { t: '#B85E00', b: '#FFB84D' }
};
export const DIR = {
  left: { t: '#B31D8F', b: '#EF6AD6' },
  down: { t: '#1E3FA8', b: '#57BDF5' },
  up: { t: '#1F9A34', b: '#86EE72' },
  right: { t: '#BF1F2B', b: '#FF6A5C' }
};
// Lane order is Left, Down, Up, Right. Rotation of the up-facing silhouette.
export const LANE_ROT = [-90, 180, 0, 90];
export const LANE_DIRS = ['left', 'down', 'up', 'right'];

// Path2D is browser-only. Build the paths lazily so this module imports cleanly
// in Node (for the pure tests and headless rendering).
let P_SIL = null, P_DET = null;
function paths() {
  if (P_SIL) return true;
  if (typeof Path2D === 'undefined') return false;
  P_SIL = new Path2D(SIL);
  P_DET = DET.map((d) => new Path2D(d));
  return true;
}

function rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
// Shade a hex toward white (p>0) or black (p<0), returning an rgba string.
export function shade(h, p, a) {
  const c = rgb(h), f = p / 100, adj = (v) => Math.round(p < 0 ? v * (1 + f) : v + (255 - v) * f);
  return 'rgba(' + adj(c[0]) + ',' + adj(c[1]) + ',' + adj(c[2]) + ',' + (a == null ? 1 : a) + ')';
}

export function colorFor(key) { return QUANT[key] || DIR[key] || QUANT[4]; }

function gradFor(ctx, key) {
  if (!ctx._gc) ctx._gc = {};
  if (ctx._gc[key]) return ctx._gc[key];
  const c = colorFor(key);
  const g = ctx.createLinearGradient(0, 22, 0, 481);
  g.addColorStop(0, c.t); g.addColorStop(1, c.b);
  ctx._gc[key] = g; return g;
}

// Draw an arrow centered at (x, y) at a given pixel size, tinted by key, rotated
// by rot degrees. opt: { alpha, glow, receptor }.
export function drawArrow(ctx, x, y, size, key, rot, opt = {}) {
  if (!paths()) return;
  const c = colorFor(key);
  ctx.save();
  ctx.globalAlpha = opt.alpha == null ? 1 : opt.alpha;
  ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180);
  const s = size / 512; ctx.scale(s, s); ctx.translate(-256, -256);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (opt.receptor) {
    if (opt.glow) { ctx.shadowColor = 'rgba(255,255,255,.5)'; ctx.shadowBlur = opt.glow; }
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fill(P_SIL);
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.stroke(P_SIL); ctx.shadowBlur = 0;
  } else {
    if (opt.glow) { ctx.shadowColor = c.b; ctx.shadowBlur = opt.glow; }
    ctx.fillStyle = gradFor(ctx, key); ctx.fill(P_SIL); ctx.shadowBlur = 0;
    ctx.lineWidth = 26; ctx.strokeStyle = ARO; ctx.stroke(P_SIL);
    ctx.fillStyle = '#fff'; P_DET.forEach((p) => ctx.fill(p));
  }
  ctx.restore();
}

// Draw a hold/freeze body from topY to botY in lane column x, tinted by key.
export function drawTrail(ctx, x, topY, botY, key, w) {
  const c = colorFor(key), H = botY - topY; if (H <= 0.5) return;
  const half = w / 2, r = Math.min(9, half);
  const outline = () => {
    ctx.beginPath();
    ctx.moveTo(x - half, topY); ctx.lineTo(x - half, botY - r);
    ctx.quadraticCurveTo(x - half, botY, x - half + r, botY);
    ctx.lineTo(x + half - r, botY); ctx.quadraticCurveTo(x + half, botY, x + half, botY - r);
    ctx.lineTo(x + half, topY); ctx.closePath();
  };
  ctx.save(); outline(); ctx.clip();
  const g = ctx.createLinearGradient(0, topY, 0, botY);
  g.addColorStop(0, shade(c.b, 0, .95)); g.addColorStop(1, shade(c.t, -30, .85));
  ctx.fillStyle = g; ctx.fillRect(x - half, topY, w, H);
  ctx.strokeStyle = shade(c.t, -45, .82); ctx.lineWidth = Math.max(3, w * 0.13); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const stepY = w * 0.6, cw = w * 0.32, ch = w * 0.2;
  for (let cy = botY - w * 0.35; cy > topY - ch; cy -= stepY) { ctx.beginPath(); ctx.moveTo(x - cw, cy); ctx.lineTo(x, cy - ch); ctx.lineTo(x + cw, cy); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.strokeStyle = shade(c.b, 25, .9); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; outline(); ctx.stroke(); ctx.restore();
}

let _svgN = 0;
// Build an inline SVG string for a direction, optionally tinted by a quant key.
// Used for menu, title, and binding specimens.
export function arrowSVG(dir, key) {
  const uid = ++_svgN;
  const c = (key != null && QUANT[key]) ? QUANT[key] : (DIR[dir] || DIR.up);
  const r = LANE_ROT[LANE_DIRS.indexOf(dir)] || 0;
  return '<svg viewBox="0 0 512 512" width="100%" height="100%" style="display:block"><g transform="rotate(' + r + ' 256 256)">' +
    '<defs><linearGradient id="ag' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.t + '"/><stop offset="1" stop-color="' + c.b + '"/></linearGradient></defs>' +
    '<path d="' + SIL + '" fill="url(#ag' + uid + ')" stroke="' + ARO + '" stroke-width="26" stroke-linejoin="round" stroke-linecap="round"/>' +
    DET.map((d) => '<path d="' + d + '" fill="#fff"/>').join('') + '</g></svg>';
}
