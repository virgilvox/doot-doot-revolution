// radar: the five axis groove radar. Compute it from a chart, or draw a radar
// object as SVG. Axes are stream, voltage, air, freeze, and chaos, each 0..1.

export const AXES = [
  ['stream', 'Stream'], ['voltage', 'Voltage'], ['air', 'Air'], ['freeze', 'Freeze'], ['chaos', 'Chaos']
];

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Compute the radar from a chart's notes and foot rating. Stand-alone so a chart
// loaded from disk gets a radar without re-running the charter.
// Every axis is measured from the chart's own notes, so it varies per song rather than
// echoing the difficulty tier. stream: sustained density. voltage: the busiest 2s (peak
// intensity, where a jump counts double). air: how many arrows are jumps. freeze: how many
// are holds. chaos: how much lands off the quarter-note pulse (syncopation).
export function computeRadar(chart) {
  const notes = chart.notes || [], count = notes.length, dur = chart.duration || durationOf(notes) || 1;
  const sorted = notes.slice().sort((a, b) => a.t - b.t);
  const nps = count / dur;
  // jumps: distinct onset times carrying two or more arrows
  let jumps = 0, i = 0;
  while (i < sorted.length) { let j = i + 1; while (j < sorted.length && Math.abs(sorted[j].t - sorted[i].t) < 1e-3) j++; if (j - i >= 2) jumps++; i = j; }
  const holds = notes.filter((n) => (n.dur || 0) > 0).length;
  // peak density: the most arrows in any 2-second window
  let peak = 0; for (let a = 0, b = 0; a < sorted.length; a++) { while (sorted[a].t - sorted[b].t > 2) b++; peak = Math.max(peak, a - b + 1); }
  const peakNps = peak / 2;
  // syncopation: arrows that fall off the quarter-note grid (eighths and finer)
  const offbeat = notes.filter((n) => n.quant && n.quant > 4).length / (count || 1);
  return {
    stream: clamp01(nps / 7), voltage: clamp01(peakNps / 11), air: clamp01(jumps / (count || 1) * 5),
    freeze: clamp01(holds / (count || 1) * 5), chaos: clamp01(offbeat * 1.4)
  };
}

function durationOf(notes) { let m = 0; for (const n of notes) m = Math.max(m, n.t + (n.dur || 0)); return m; }

// Inner SVG markup for a radar in a 168x168 viewBox. Colors use the --purple and
// --ink CSS variables so it inherits the palette.
export function radarSVG(radar, opt = {}) {
  const cx = opt.cx || 84, cy = opt.cy || 84, R = opt.r || 62, N = AXES.length;
  let grid = '', spokes = '', dots = '', pts = [];
  for (let r = 1; r <= 3; r++) {
    let p = '';
    for (let i = 0; i < N; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / N, x = cx + Math.cos(a) * R * r / 3, y = cy + Math.sin(a) * R * r / 3; p += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
    grid += '<path d="' + p + 'Z" fill="none" stroke="rgba(34,32,63,.18)" stroke-width="1.5"/>';
  }
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / N, x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
    spokes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="rgba(34,32,63,.14)" stroke-width="1.5"/>';
    const v = clamp01(radar ? radar[AXES[i][0]] : 0), px = cx + Math.cos(a) * R * v, py = cy + Math.sin(a) * R * v;
    pts.push(px.toFixed(1) + ',' + py.toFixed(1));
    dots += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="3.4" fill="var(--purple)" stroke="var(--ink)" stroke-width="1.5"/>';
  }
  return grid + spokes + '<polygon points="' + pts.join(' ') + '" fill="rgba(155,92,255,.28)" stroke="var(--purple)" stroke-width="3" stroke-linejoin="round"/>' + dots;
}
