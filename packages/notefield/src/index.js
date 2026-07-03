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
// Receptor hit feedback intensity per judgment. The better the timing, the more
// the receptor pops and glows, so a Marvelous reads as louder than a Good.
const POP_STRENGTH = { marvelous: 1, perfect: 0.82, great: 0.55, good: 0.38 };
const POP_DUR = 0.16;
// Judgment word size multiplier: a Marvelous is bigger and louder than a Good,
// reinforcing the positive-result hierarchy without punishing the weaker ones.
const JUDGE_TEXT_SCALE = { marvelous: 1.18, perfect: 1.0, great: 0.9, good: 0.82, boo: 0.85, miss: 0.85, drop: 0.85 };

export function createNotefield(canvas, config = {}) {
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1, ro = null, winResize = null;
  const blasts = [];
  const recvPop = [null, null, null, null];
  const particles = [];
  // combo feel state (real time), so the counter punches on each increment and
  // celebrates milestones
  let lastCombo = 0, comboAt = -9, milestoneAt = -9;
  // reduced motion trims the cosmetic juice (sparks, beat pulse, miss tint) while
  // keeping the essential feedback (receptor pop, judgment, combo). No screen
  // shake is used at all: shaking a precision note field hurts readability.
  let reducedMotion = false;
  const rnd = () => Math.random();
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

  // Push an expanding hit ring on a lane at song time t0. strength scales the
  // ring size and brightness so a better judgment reads bigger.
  function blast(lane, color, t0, strength = 1) { blasts.push({ lane, color, t0, strength }); }

  // Register a judged hit: pops the receptor (raise + glow), rings the lane, and
  // sprays sparks, all scaled by the judgment. Non-scoring judgments do nothing.
  function hit(lane, judgment, t0) {
    const strength = POP_STRENGTH[judgment] || 0;
    if (strength <= 0) return;
    recvPop[lane] = { t0, strength };
    const color = JUDGE_COLOR[judgment] || '#fff';
    blast(lane, color, t0, strength);
    if (!reducedMotion) spawnParticles(lane, strength, t0, color);
  }
  function setReducedMotion(v) { reducedMotion = !!v; }

  // A radial spark burst from the receptor. More and faster sparks for a better
  // judgment (accumulation, not substitution). Cosmetic, so Math.random is fine.
  function spawnParticles(lane, strength, t0, color) {
    const g = geom(), x = g.startX + g.gap * lane, y = g.recY;
    const n = 8 + Math.round(15 * strength);
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2, sp = (90 + rnd() * 170) * (0.55 + strength);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t0, life: 0.26 + rnd() * 0.20, color, r: 1.6 + rnd() * 3 * strength });
    }
  }

  // Render the field at song time. opts: { speed, judge, held, beats }.
  function render(time, chart, opts = {}) {
    const speed = opts.speed || 2.4, judge = opts.judge || null, held = opts.held || null;
    const g = geom(); if (!w || !h) return;
    const { startX, gap, laneW, recY } = g;
    ctx.clearRect(0, 0, w, h);
    // XMOD scroll works in beats, not seconds: a measure is always the same height,
    // so BPM changes and stops read correctly (notes speed up, slow down, and freeze
    // with the music). currentBeat comes from the session's timing map (opts.beat);
    // fall back to a constant tempo for the editor and any caller without a map.
    const beat = opts.beat != null ? opts.beat : (chart.bpm ? (time - (chart.offset || 0)) / (60 / chart.bpm) : 0);
    const ppb = speed * laneW;

    // a brief red field-tint on a miss: felt, not punishing, and it never
    // obscures the notes (edges only, low alpha, fast fade)
    if (!reducedMotion && judge && judge.lastJudge) {
      const mj = judge.lastJudge, ma = now() - mj.at;
      if ((mj.type === 'miss' || mj.type === 'boo' || mj.type === 'drop') && ma < 350) {
        const al = (1 - ma / 350) * 0.26, grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.62);
        grd.addColorStop(0, 'rgba(255,60,90,0)'); grd.addColorStop(1, 'rgba(255,60,90,' + al.toFixed(3) + ')');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
      }
    }

    // lane guides and press glow
    for (let i = 0; i < cols; i++) {
      const x = startX + gap * i;
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(x - laneW * 0.62, 0, laneW * 1.24, h);
      const on = held ? held[i] : (judge && judge.holdActive[i]);
      if (on) { const grad = ctx.createLinearGradient(0, h, 0, recY); grad.addColorStop(0, 'rgba(137,240,216,0)'); grad.addColorStop(1, 'rgba(137,240,216,.16)'); ctx.fillStyle = grad; ctx.fillRect(x - laneW * 0.62, recY, laneW * 1.24, h - recY); }
    }

    // beat lines, drawn at each integer beat around the current beat (measure lines
    // every fourth beat). Beat-space, so they track BPM changes and stops for free.
    if (opts.beats !== false && ppb > 0) {
      const first = Math.floor(beat) - 1;
      for (let k = first; k < first + 400; k++) {
        const by = recY + (k - beat) * ppb;
        if (by > h + 20) break;
        if (by < -20) continue;
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
        const eb = n.endBeat != null ? n.endBeat : n.beat;
        const rawY = recY + (n.beat - beat) * ppb, tailY = recY + (eb - beat) * ppb;
        if (tailY < recY - 2 || rawY > h + 50) continue;
        const topY = holding ? recY : rawY, x = startX + gap * n.lane;
        drawTrail(ctx, x, topY, tailY, n.quant, laneW * 0.5);
        drawArrow(ctx, x, tailY, laneW * 0.9, n.quant, LANE_ROT[n.lane], { alpha: .9 });
        const near = Math.abs(topY - recY) < 24; drawArrow(ctx, x, topY, laneW * 0.98, n.quant, LANE_ROT[n.lane], { glow: near ? 18 : 0 });
      } else {
        if (jn && jn.judged) continue;
        const y = recY + (n.beat - beat) * ppb; if (y < recY - 40 || y > h + 50) continue;
        const near = Math.abs(y - recY) < 24; drawArrow(ctx, startX + gap * n.lane, y, laneW * 0.98, n.quant, LANE_ROT[n.lane], { glow: near ? 16 : 0 });
      }
    }

    // hit blasts, sized and brightened by the judgment strength
    for (let i = blasts.length - 1; i >= 0; i--) {
      const bl = blasts[i], age = time - bl.t0;
      if (age > 0.30 || age < 0) { blasts.splice(i, 1); continue; }
      const s = bl.strength == null ? 1 : bl.strength, pr = age / 0.30;
      const rad = laneW * 0.5 + pr * laneW * (0.6 + 0.7 * s), al = (1 - pr) * (0.35 + 0.5 * s);
      ctx.save(); ctx.globalAlpha = al; ctx.strokeStyle = bl.color; ctx.lineWidth = (2 + 3 * s) * (1 - pr) + 0.5;
      ctx.beginPath(); ctx.arc(startX + gap * bl.lane, recY, rad, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    // spark particles, with a little gravity, fading out
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], age = time - p.t0;
      if (age < 0 || age > p.life) { particles.splice(i, 1); continue; }
      const pr = age / p.life, px = p.x + p.vx * age, py = p.y + p.vy * age + 160 * age * age;
      ctx.save(); ctx.globalAlpha = 1 - pr; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(px, py, Math.max(0.4, p.r * (1 - pr * 0.6)), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    // receptors on top. A recent hit pops the receptor larger and brighter, more
    // for a better judgment; a gentle beat-pulse keeps the field alive and gives
    // the eye a rhythmic anchor for timing.
    let beatPulse = 0;
    if (!reducedMotion) { const fb = beat - Math.floor(beat); beatPulse = Math.max(0, 1 - fb / 0.5); }
    for (let i = 0; i < cols; i++) {
      const x = startX + gap * i;
      const on = held ? held[i] : (judge && judge.holdActive[i]);
      let popS = 0; const pop = recvPop[i];
      if (pop) { const age = time - pop.t0; if (age >= 0 && age < POP_DUR) popS = pop.strength * (1 - age / POP_DUR); else recvPop[i] = null; }
      const size = laneW * 0.98 * (1 + 0.16 * popS + 0.05 * beatPulse), glow = (on ? 22 : 6) + 55 * popS + 7 * beatPulse;
      drawArrow(ctx, x, recY, size, 4, LANE_ROT[i], { receptor: true, glow });
      if (popS > 0.02) { drawArrow(ctx, x, recY, size, 4, LANE_ROT[i], { receptor: true, glow: 8, alpha: 0.5 * popS }); }
    }
  }

  function feedback(g, judge) {
    const cx = g.w / 2, cy = g.recY + (g.h - g.recY) * 0.42, tnow = now();
    const j = judge.lastJudge, age = j ? tnow - j.at : 9999;
    if (j && age < 650) {
      // scale pop: a quick overshoot in the first ~130ms, then settle. Sized by
      // judgment so a Marvelous punches bigger than a Good.
      const pop = 1 + 0.42 * Math.max(0, 1 - age / 130), jscale = JUDGE_TEXT_SCALE[j.type] || 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 650); ctx.textAlign = 'center';
      ctx.translate(cx, cy); ctx.scale(pop, pop);
      ctx.fillStyle = JUDGE_COLOR[j.type] || '#fff'; ctx.font = '800 ' + Math.round(Math.min(g.w * 0.07, 44) * jscale) + 'px "Baloo 2",sans-serif';
      ctx.shadowColor = 'rgba(21,19,44,.6)'; ctx.shadowOffsetY = 3; ctx.fillText(JUDGE_LABEL[j.type] || '', 0, 0);
      ctx.restore();
      if (j.type !== 'miss' && j.type !== 'drop' && j.dt != null) {
        const ms = Math.round(j.dt * 1000), lab = Math.abs(ms) <= 5 ? '' : (ms > 0 ? 'LATE +' + ms + 'ms' : 'EARLY ' + ms + 'ms');
        if (lab) { ctx.save(); ctx.globalAlpha = Math.max(0, 1 - age / 650); ctx.textAlign = 'center'; ctx.font = '700 12px "Outfit",sans-serif'; ctx.fillStyle = ms > 0 ? '#ff8f6a' : '#6aa8ff'; ctx.fillText(lab, cx, cy + 22); ctx.restore(); }
      }
    }
    // combo: punch on each increment, celebrate every 50th, so the counter feels
    // like the reward it is
    if (judge.combo !== lastCombo) { if (judge.combo > lastCombo) { comboAt = tnow; if (judge.combo % 50 === 0) milestoneAt = tnow; } lastCombo = judge.combo; }
    if (judge.combo > 2) {
      const punch = 1 + 0.3 * Math.max(0, 1 - (tnow - comboAt) / 100), milAge = tnow - milestoneAt, mil = milAge < 500 ? Math.max(0, 1 - milAge / 500) : 0;
      ctx.save(); ctx.textAlign = 'center'; ctx.globalAlpha = .92;
      ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '800 13px "Outfit",sans-serif'; ctx.fillText('COMBO', cx, cy + 30);
      ctx.translate(cx, cy + 78); ctx.scale(punch, punch);
      ctx.fillStyle = mil > 0 ? '#FFE14D' : '#fff'; ctx.font = '800 ' + Math.round(Math.min(g.w * 0.11, 64)) + 'px "Baloo 2",sans-serif';
      ctx.shadowColor = '#15132c'; ctx.shadowOffsetY = 4; ctx.fillText(judge.combo, 0, 0);
      ctx.restore();
      if (mil > 0) { ctx.save(); ctx.globalAlpha = mil; ctx.strokeStyle = '#FFE14D'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy + 70, 60 + (1 - mil) * 90, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
  }

  return { resize, observe, disconnect, render, blast, hit, setReducedMotion, geom, laneX, pps, yAtTime, timeAtY };
}
