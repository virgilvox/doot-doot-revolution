// charter: turn an analysis plus a tempo into a playable chart. Pure logic, no
// DOM, seeded so the same inputs always produce the same chart.
//
// Two stages, after the Dance Dance Convolution decomposition but using
// classical signal processing rather than a trained net:
//   1. Placement. Quantize onsets to the difficulty's rhythmic grid, dedupe grid
//      slots keeping the strongest, and thin to a notes-per-second cap.
//   2. Selection. Walk the placed rows assigning arrows with strict foot
//      alternation. A foot only reaches panels on its own body side, so no
//      crossover appears unless the tier's crossover probability adds one.
//      Footswitches (same panel, alternating feet) unlock the same way. Low
//      tiers forbid both, which keeps beginner charts forward-facing.
//
// Lane bias 'drum' routes low band energy toward Down and high toward Up so
// arrows track the drum kit. Lane bias 'none' (Quick) ignores the bands and
// leans on alternation and the home-side backbone only.

// Difficulty table. foot is the StepMania-style meter shown in menus. subs are
// the allowed beat subdivisions. crossover and footswitch are probabilities,
// zero at the low tiers so those patterns never appear there.
// Foot meters follow DDR convention (Beginner very sparse, Basic a step-on-the-beat
// chart, up to a dense Challenge) and the notes-per-second caps scale with them:
// Basic sits near quarter-note density so it reads as genuinely easy, not a
// mislabeled Standard chart.
// Only 1/2/4 (quarter/eighth/sixteenth) ever occur on the 16-step grid, so the tiers
// step up by subdivision: Beginner quarters, Basic/Difficult eighths, Expert/Challenge
// sixteenths, with the notes-per-second cap and layers separating the pairs. Foot
// meters follow DDR convention so Basic reads as genuinely easy.
// maxNps is a PEAK cap (the minimum spacing between consecutive notes is 1/maxNps), not
// an average. DDR/StepMania convention: Beginner is quarter-note sparse, Basic a
// step-on-the-beat chart, Difficult a steady eighth-note stream, Expert dense eighths
// with sixteenth bursts and frequent jumps, Challenge sixteenth streams. The earlier caps
// topped Expert at 6.5 peak nps, which reads as a busy Difficult rather than an Expert
// (sixteenths at ~130 bpm need ~8.7 nps), so mid and high tiers were raised to let real
// eighth and sixteenth streams through and the jump rates lifted so the top tiers feel
// technical, not just fast.
// The composed charter (chartFromPiece) gates density by subdivision COVERAGE, which is
// tempo-independent: `eighth` and `sixteenth` are the fraction of eighth- and
// sixteenth-grid onsets to keep. A fixed notes-per-second cap does not work here because
// at ~160 bpm sixteenths run ~10.7 nps and any Expert-ish cap drops them all, collapsing
// Expert into Difficult; coverage keeps Expert's sixteenth bursts at every tempo. Below
// full coverage, sixteenths are kept as runs (bursts) rather than isolated galloping
// singles. `maxNps` still caps the audio charter (noisy onsets, so peak spacing is the
// right tool there), and doubles as a high safety limit for composed charts.
export const DIFFS = {
  beginner:  { name: 'Beginner',  foot: 2,  subs: [1],       eighth: 0.00, sixteenth: 0.00, minStrength: 0.50, maxNps: 2.2,  jumpProb: 0.00, jumpMin: 9,    crossover: 0.00, footswitch: 0.00, holdProb: 0.22 },
  basic:     { name: 'Basic',     foot: 4,  subs: [1, 2],    eighth: 0.50, sixteenth: 0.00, minStrength: 0.30, maxNps: 3.4,  jumpProb: 0.03, jumpMin: 0.80, crossover: 0.00, footswitch: 0.00, holdProb: 0.16 },
  difficult: { name: 'Difficult', foot: 8,  subs: [1, 2],    eighth: 1.00, sixteenth: 0.00, minStrength: 0.16, maxNps: 5.5,  jumpProb: 0.12, jumpMin: 0.72, crossover: 0.05, footswitch: 0.05, holdProb: 0.12 },
  expert:    { name: 'Expert',    foot: 12, subs: [1, 2, 4], eighth: 1.00, sixteenth: 0.55, minStrength: 0.09, maxNps: 8.3,  jumpProb: 0.22, jumpMin: 0.62, crossover: 0.10, footswitch: 0.10, holdProb: 0.11 },
  challenge: { name: 'Challenge', foot: 15, subs: [1, 2, 4], eighth: 1.00, sixteenth: 1.00, minStrength: 0.04, maxNps: 12.0, jumpProb: 0.44, jumpMin: 0.52, crossover: 0.14, footswitch: 0.16, holdProb: 0.08 }
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Deterministic RNG (mulberry32) seeded by a string, so a title plus difficulty
// always charts the same way.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashSeed(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// Nearest simple subdivision of a beat, used to color the note by quantization.
function quantOf(beat) { const subs = [1, 2, 3, 4, 6, 8]; for (let i = 0; i < subs.length; i++) { const d = subs[i]; if (Math.abs(beat * d - Math.round(beat * d)) < 0.02) return d; } return 8; }
function denomToNote(d) { return ({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 })[d] || 32; }

// Drop rows that would exceed the notes-per-second cap, keeping the stronger of
// two that fall too close together.
function thinByNPS(list, period, maxNps) {
  if (list.length < 2) return list;
  const minDt = 1 / maxNps, out = [list[0]];
  for (let i = 1; i < list.length; i++) {
    const prev = out[out.length - 1], dt = (list[i].beat - prev.beat) * period;
    if (dt >= minDt) out.push(list[i]);
    else if (list[i].strength > prev.strength) out[out.length - 1] = list[i];
  }
  return out;
}

// Choose a panel for one foot without crossing the body, biased to the home side
// and (in drum mode) nudged by the onset's band energy. Exported so the composed-piece
// charter shares the exact same foot logic (home-side bias, controlled crossover and
// footswitch) rather than a simpler alternation, keeping difficulty feel consistent.
export function pickPanel(foot, last, prev, r, rng, D, allowRepeat, useBands) {
  let cands = foot === 0 ? [0, 1, 2] : [3, 2, 1];        // left foot reaches L/D/U, right reaches R/U/D
  if (rng() < D.crossover) cands.push(foot === 0 ? 3 : 0); // controlled crossover at high tiers only
  if (!allowRepeat) cands = cands.filter((p) => p !== last);
  if (!cands.length) cands = [foot === 0 ? 0 : 3];
  const tot = r.lo + r.mi + r.hi + 1e-9, lo = r.lo / tot, mi = r.mi / tot, hi = r.hi / tot;
  const home = foot === 0 ? 0 : 3, cross = foot === 0 ? 3 : 0;
  let best = cands[0], bw = -1;
  for (let i = 0; i < cands.length; i++) {
    const p = cands[i];
    const base = (p === home) ? 1.0 : ((p === cross) ? 0.45 : 0.6);
    const nudge = useBands ? ((p === 1) ? 0.30 * lo : ((p === 2) ? 0.30 * hi : 0.12 * mi)) : 0;
    let w = (base + nudge) * (0.7 + 0.6 * rng());
    if (p === prev) w *= 0.7;
    if (w > bw) { bw = w; best = p; }
  }
  return best;
}

// generate(analysis, tempo, options) -> chart
//   options: { difficulty, laneBias: 'drum'|'none', seed, engine, engineUsed }
export function generate(analysis, tempo, options = {}) {
  const difficulty = options.difficulty || 'basic';
  const D = DIFFS[difficulty] || DIFFS.basic;
  const useBands = (options.laneBias || 'drum') !== 'none';
  const bpm = tempo.bpm, offset = tempo.offset != null ? tempo.offset : (tempo.offsetSec || 0), period = 60 / bpm;
  const rng = mulberry32(hashSeed((options.seed || 'ddr') + '|' + difficulty + '|' + Math.round(bpm)));
  const onsets = analysis.onsets || [];

  // stage 1: placement. quantize each onset to the tier grid, merge grid slots.
  const rows = {}, tol = 0.16;
  for (let i = 0; i < onsets.length; i++) {
    const o = onsets[i];
    if (o.strength < D.minStrength) continue;
    const beatPos = (o.time - offset) / period;
    if (beatPos < -0.5) continue;
    let chosen = null, cErr = 1e9;
    for (let a = 0; a < D.subs.length; a++) { const d = D.subs[a], cand = Math.round(beatPos * d) / d, err = Math.abs(cand - beatPos); if (err <= tol / d && err < cErr) { chosen = { beat: cand }; cErr = err; } }
    if (!chosen) continue;
    const key = Math.round(chosen.beat * 48);
    if (rows[key]) { const e = rows[key]; e.strength = Math.max(e.strength, o.strength); e.lo += o.lo; e.mi += o.mid; e.hi += o.hi; }
    else rows[key] = { beat: chosen.beat, strength: o.strength, lo: o.lo, mi: o.mid, hi: o.hi };
  }
  let list = Object.keys(rows).map((k) => rows[k]).sort((a, b) => a.beat - b.beat);
  list = thinByNPS(list, period, D.maxNps);

  // stage 2: selection. alternate feet, keep charts physically playable.
  const notes = [];
  let lastFoot = -1, lastPanel = -1, prevPanel = -1, lastBeat = -99;
  for (let i = 0; i < list.length; i++) {
    const r = list[i], qd = quantOf(r.beat), note = denomToNote(qd), time = offset + r.beat * period, dtBeat = r.beat - lastBeat;
    if (r.strength > D.jumpMin && dtBeat >= 0.5 && rng() < D.jumpProb) {
      const pair = rng() < 0.5 ? [0, 3] : [1, 2];
      notes.push({ t: time, beat: r.beat, lane: pair[0], dur: 0, quant: note, type: 'tap' });
      notes.push({ t: time, beat: r.beat, lane: pair[1], dur: 0, quant: note, type: 'tap' });
      lastFoot = -1; lastPanel = -1; prevPanel = -1;
    } else {
      const allowRepeat = rng() < D.footswitch;
      const foot = lastFoot === 0 ? 1 : (lastFoot === 1 ? 0 : (rng() < 0.5 ? 0 : 1));
      const panel = pickPanel(foot, lastPanel, prevPanel, r, rng, D, allowRepeat, useBands);
      notes.push({ t: time, beat: r.beat, lane: panel, dur: 0, quant: note, type: 'tap' });
      prevPanel = lastPanel; lastPanel = panel; lastFoot = foot;
    }
    lastBeat = r.beat;
  }

  // holds: promote a single tap to a freeze when a long gap follows it.
  for (let i = 0; i < notes.length - 1; i++) {
    const n = notes[i];
    if (n.type !== 'tap' || n.dur > 0) continue;
    // do not hold a note that shares its row with another (a jump)
    if (notes[i + 1] && Math.abs(notes[i + 1].beat - n.beat) < 1e-3 && notes[i + 1].lane !== n.lane) continue;
    const next = notes[i + 1];
    const gap = next.beat - n.beat;
    if (gap >= 1.5 && rng() < D.holdProb) {
      let len = Math.min(gap * 0.55, 2.0); len = Math.max(0.5, Math.round(len * 2) / 2);
      n.type = 'hold'; n.dur = len * period; n.endBeat = n.beat + len;
    }
  }

  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);

  const count = notes.length, dur = analysis.duration || 1, nps = count / dur;
  const jumps = countJumps(notes), holds = notes.filter((n) => n.dur > 0).length, busy = notes.filter((n) => n.quant >= 16).length / (count || 1);
  const radar = {
    stream: clamp01(nps / 8), voltage: clamp01(D.foot / 15), air: clamp01(jumps / (count || 1) * 5),
    freeze: clamp01(holds / (count || 1) * 5), chaos: clamp01(busy * 1.5)
  };

  return {
    bpm, offset, difficulty, foot: D.foot, meter: D.foot, duration: dur,
    // a generated chart has one constant tempo and no stops; imported StepMania
    // charts carry a full map. createTiming reads these either way.
    bpms: [{ beat: 0, bpm }], stops: [],
    engine: options.engine || 'drum', engineUsed: options.engineUsed || (useBands ? 'drum-aware' : 'quick (onset+tempo)'),
    notes, count, radar
  };
}

// Count rows that carry two or more arrows (jumps).
function countJumps(notes) {
  let c = 0, i = 0;
  const sorted = notes.slice().sort((a, b) => a.t - b.t);
  while (i < sorted.length) { let j = i + 1; while (j < sorted.length && Math.abs(sorted[j].t - sorted[i].t) < 1e-3) j++; if (j - i >= 2) c++; i = j; }
  return c;
}

// Nominal radar for a difficulty before a chart exists, so menus can preview it.
export function nominalRadar(difficulty) {
  const D = DIFFS[difficulty] || DIFFS.basic, f = D.foot / 15;
  return { stream: Math.min(1, f * 0.9 + 0.1), voltage: Math.min(1, f), air: Math.min(1, D.jumpProb * 3), freeze: Math.min(1, D.holdProb * 4), chaos: Math.min(1, f * 0.8) };
}

// createTiming: convert between beats and audio time given a tempo map and stops,
// the way StepMania does. A chart is authored in beats; this maps a beat to the
// second it sounds (and back), honoring every BPM change and stop so gimmick
// charts stay in sync. A constant-tempo chart is just the one-segment case.
//
//   chart.offset  audio time (seconds) of beat 0. Negative offsets (a lead-in) are
//                 fine; beats before 0 extrapolate on the first BPM.
//   chart.bpms    [{ beat, bpm }] sorted; defaults to [{ beat: 0, bpm: chart.bpm }].
//   chart.stops   [{ beat, seconds }] a pause of `seconds` when the beat is reached.
//
// The map is a list of (beat, time) anchors, piecewise linear between them. A stop
// is a vertical step: the same beat at two times, so time advances while the beat
// (and therefore every arrow on screen) holds still.
export function createTiming(chart) {
  const offset = chart.offset || 0;
  const bpms = (chart.bpms && chart.bpms.length ? chart.bpms.slice() : [{ beat: 0, bpm: chart.bpm || 120 }]).sort((a, b) => a.beat - b.beat);
  // StepMania always anchors a BPM at beat 0; guard a malformed file that does not
  // so the anchor list stays monotonic (the first tempo applies from the start).
  if (bpms[0].beat > 0) bpms.unshift({ beat: 0, bpm: bpms[0].bpm });
  const stops = (chart.stops || []).slice().sort((a, b) => a.beat - b.beat);

  const events = [];
  for (let i = 1; i < bpms.length; i++) events.push({ beat: bpms[i].beat, bpm: bpms[i].bpm });
  for (const s of stops) if (s.seconds > 0) events.push({ beat: s.beat, stop: s.seconds });
  // at a shared beat, apply the stop before a BPM change so the pause uses the old tempo
  events.sort((a, b) => a.beat - b.beat || ((a.stop ? 0 : 1) - (b.stop ? 0 : 1)));

  const anchors = [{ beat: bpms[0].beat, time: offset }];
  let curBeat = bpms[0].beat, curTime = offset, spb = 60 / bpms[0].bpm;
  for (const ev of events) {
    curTime += (ev.beat - curBeat) * spb; curBeat = ev.beat;
    anchors.push({ beat: curBeat, time: curTime });
    if (ev.stop) { curTime += ev.stop; anchors.push({ beat: curBeat, time: curTime }); }
    else spb = 60 / ev.bpm;
  }
  const tailSpb = spb, tailBeat = curBeat, tailTime = curTime;

  function beatToTime(beat) {
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (b.beat === a.beat) continue; // a stop has no beat width
      if (beat <= b.beat) return a.time + (beat - a.beat) / (b.beat - a.beat) * (b.time - a.time);
    }
    return tailTime + (beat - tailBeat) * tailSpb;
  }
  function timeToBeat(time) {
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (time <= b.time) {
        if (b.beat === a.beat || b.time === a.time) return a.beat; // frozen during a stop
        return a.beat + (time - a.time) / (b.time - a.time) * (b.beat - a.beat);
      }
    }
    return tailBeat + (time - tailTime) / tailSpb;
  }
  // seconds per beat at a given time, for anything that still wants a local tempo
  function bpmAtTime(time) {
    const b = timeToBeat(time);
    let cur = bpms[0].bpm;
    for (const p of bpms) { if (p.beat <= b + 1e-6) cur = p.bpm; else break; }
    return cur;
  }

  return { beatToTime, timeToBeat, bpmAtTime, offset, firstBpm: bpms[0].bpm };
}
