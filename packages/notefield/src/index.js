// notefield: the scrolling notefield on a canvas. Upscroll, receptors near the
// top, notes rising from below to meet them, driven entirely by song time. Used
// by gameplay and, in a narrow variant, by the editor.
//
// Scroll speed is XMOD, verified against StepMania: a note beats_away from now
// sits beats_away * speed note-heights past the receptor, so pixels per second =
// (bpm / 60) * speed * noteSize. A speed of 2.4 travels 2.4 note-heights per beat.

import { drawArrow, drawTrail, LANE_ROT } from '@doot-games/noteskin';

const JUDGE_COLOR = { marvelous: '#89f0d8', perfect: '#89f0d8', great: '#86EE72', good: '#8fc0ff', boo: '#FF9B2E', miss: '#FF7A8A', drop: '#FF7A8A' };
const JUDGE_LABEL = { marvelous: 'MARVELOUS', perfect: 'PERFECT', great: 'GREAT', good: 'GOOD', boo: 'BOO', miss: 'MISS', drop: 'DROP' };

export function createNotefield(canvas, config = {}) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, ro = null, winResize = null;
  const blasts = [];
  const now = config.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const cols = 4;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    w = r.width; h = r.height;
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx._gc = null;
  }
  function observe() {
    if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(resize); ro.observe(canvas); }
    else if (typeof window !== 'undefined') { winResize = resize; window.addEventListener('resize', winResize); }
    resize();
  }
  function disconnect() { if (ro) ro.disconnect(); if (winResize && typeof window !== 'undefined') { window.removeEventListener('resize', winResize); winResize = null; } }

  // Geometry adapts to the canvas. recFrac places receptors as a fraction of
  // height from the top (near the top for gameplay).
  function geom() {
    const gap = Math.min((w * (config.spread || 0.86)) / cols, config.maxGap || 116);
    const laneW = Math.min(gap * 0.9, config.maxLaneW || 92);
    const startX = w / 2 - gap * (cols - 1) / 2;
    const recY = Math.max(config.minRecY || 70, h * (config.recFrac || 0.18));
    return { w, h, gap, laneW, startX, recY };
  }
  function pps(chart, speed) { const g = geom(); const noteSize = g.laneW; return (chart.bpm / 60) * speed * noteSize; }
  function laneX(i) { const g = geom(); return g.startX + g.gap * i; }
  function yAtTime(t, now, chart, speed) { const g = geom(); return g.recY + (t - now) * pps(chart, speed); }
  function timeAtY(y, now, chart, speed) { const g = geom(); return now + (y - g.recY) / pps(chart, speed); }

  // Push an expanding hit ring on a lane at song time t0.
  function blast(lane, color, t0) { blasts.push({ lane, color, t0 }); }

  // Render the field at song time. opts: { speed, judge, held, beats }.
  function render(time, chart, opts = {}) {
    const speed = opts.speed || 2.4, judge = opts.judge || null, held = opts.held || null;
    const g = geom(); if (!w || !h) return;
    const { startX, gap, laneW, recY } = g;
    ctx.clearRect(0, 0, w, h);
    const rate = pps(chart, speed);

    // lane guides and press glow
    for (let i = 0; i < cols; i++) {
      const x = startX + gap * i;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x - laneW * 0.62, 0, laneW * 1.24, h);
      const on = held ? held[i] : (judge && judge.holdActive[i]);
      if (on) { const grad = ctx.createLinearGradient(0, h, 0, recY); grad.addColorStop(0, 'rgba(137,240,216,0)'); grad.addColorStop(1, 'rgba(137,240,216,.16)'); ctx.fillStyle = grad; ctx.fillRect(x - laneW * 0.62, recY, laneW * 1.24, h - recY); }
    }

    // beat lines
    if (opts.beats !== false && chart.bpm) {
      const per = 60 / chart.bpm, first = Math.floor((time - chart.offset) / per) - 1;
      for (let k = first; k < first + 48; k++) {
        const bt = chart.offset + k * per, by = recY + (bt - time) * rate;
        if (by < -20 || by > h + 20) continue;
        const meas = (k % 4 === 0);
        ctx.strokeStyle = meas ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.04)'; ctx.lineWidth = meas ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(startX - laneW * 0.62, by); ctx.lineTo(startX + gap * (cols - 1) + laneW * 0.62, by); ctx.stroke();
      }
    }

    // center feedback behind notes, classic DDR
    if (judge && opts.showFeedback !== false) feedback(g, judge);

    // notes. When a judge is present it was built from this same chart, so its
    // tracking array lines up by index (no per-note search).
    for (let idx = 0; idx < chart.notes.length; idx++) {
      const n = chart.notes[idx];
      const jn = judge ? judge.notes[idx] : null;
      if (n.dur > 0) {
        const holding = jn && jn.holding;
        if (jn && jn.done && !holding) continue;
        const rawY = recY + (n.t - time) * rate, tailY = recY + (n.t + n.dur - time) * rate;
        if (tailY < recY - 2 || rawY > h + 50) continue;
        const topY = holding ? recY : rawY, x = startX + gap * n.lane;
        drawTrail(ctx, x, topY, tailY, n.quant, laneW * 0.5);
        drawArrow(ctx, x, tailY, laneW * 0.9, n.quant, LANE_ROT[n.lane], { alpha: .9 });
        const near = Math.abs(topY - recY) < 24; drawArrow(ctx, x, topY, laneW * 0.98, n.quant, LANE_ROT[n.lane], { glow: near ? 18 : 0 });
      } else {
        if (jn && jn.judged) continue;
        const y = recY + (n.t - time) * rate; if (y < recY - 40 || y > h + 50) continue;
        const near = Math.abs(y - recY) < 24; drawArrow(ctx, startX + gap * n.lane, y, laneW * 0.98, n.quant, LANE_ROT[n.lane], { glow: near ? 16 : 0 });
      }
    }

    // hit blasts
    for (let i = blasts.length - 1; i >= 0; i--) {
      const bl = blasts[i], age = time - bl.t0;
      if (age > 0.30 || age < 0) { blasts.splice(i, 1); continue; }
      const pr = age / 0.30, rad = laneW * 0.5 + pr * laneW * 0.9, al = (1 - pr) * 0.8;
      ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = bl.color; ctx.lineWidth = 3 * (1 - pr) + 0.5;
      ctx.beginPath(); ctx.arc(startX + gap * bl.lane, recY, rad, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    // receptors on top
    for (let i = 0; i < cols; i++) {
      const on = held ? held[i] : (judge && judge.holdActive[i]);
      drawArrow(ctx, startX + gap * i, recY, laneW * 0.98, 4, LANE_ROT[i], { receptor: true, glow: on ? 22 : 6 });
    }
  }

  function feedback(g, judge) {
    const cx = g.w / 2, cy = g.recY + (g.h - g.recY) * 0.42;
    const j = judge.lastJudge, age = j ? now() - j.at : 9999;
    if (j && age < 650) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 650); ctx.textAlign = 'center';
      ctx.fillStyle = JUDGE_COLOR[j.type] || '#fff'; ctx.font = '800 ' + Math.round(Math.min(g.w * 0.07, 44)) + 'px "Baloo 2",sans-serif';
      ctx.shadowColor = 'rgba(21,19,44,.6)'; ctx.shadowOffsetY = 3; ctx.fillText(JUDGE_LABEL[j.type] || '', cx, cy);
      if (j.type !== 'miss' && j.type !== 'drop' && j.dt != null) {
        const ms = Math.round(j.dt * 1000), lab = Math.abs(ms) <= 5 ? '' : (ms > 0 ? 'LATE +' + ms + 'ms' : 'EARLY ' + ms + 'ms');
        ctx.shadowOffsetY = 0; ctx.font = '700 12px "Outfit",sans-serif'; ctx.fillStyle = ms > 0 ? '#ff8f6a' : '#6aa8ff'; if (lab) ctx.fillText(lab, cx, cy + 20);
      }
      ctx.restore();
    }
    if (judge.combo > 2) {
      ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = .92;
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '800 13px "Outfit",sans-serif'; ctx.fillText('COMBO', cx, cy + 30);
      ctx.fillStyle = '#fff'; ctx.font = '800 ' + Math.round(Math.min(g.w * 0.11, 64)) + 'px "Baloo 2",sans-serif'; ctx.shadowColor = '#15132c'; ctx.shadowOffsetY = 4; ctx.fillText(judge.combo, cx, cy + 84); ctx.restore();
    }
  }

  return { resize, observe, disconnect, render, blast, geom, laneX, pps, yAtTime, timeAtY };
}
