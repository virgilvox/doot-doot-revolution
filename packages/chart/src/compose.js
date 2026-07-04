// compose: a deterministic, seeded generative composer, adapted from the ferrule
// engine. Functional-harmony Markov chord progressions drive sections with an
// intensity arc; Euclidean rhythms place bass/arp/drums; a chord-tone-snapped
// Markov melody writes the lead (and a parallel-third counter). Everything lands on
// a 16-step-per-bar grid, so onsets fall on real subdivisions (4th/8th/16th). Pure
// logic: composePiece returns a PIECE (data only, no audio), which the synth renders
// and chartFromPiece turns into steps. Same seed always yields the same piece.

/* ---------- seeded PRNG (mulberry32) ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function strHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function makeRng(seed) { const n = (typeof seed === 'number') ? (seed >>> 0) : strHash(String(seed)); return mulberry32(n); }
export function mixSeed(base, n) { return (strHash(String(base)) ^ Math.imul(n + 1, 2654435761)) >>> 0; }
function rInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
function rFloat(rng, a, b) { return a + rng() * (b - a); }
function rPick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function rChance(rng, p) { return rng() < p; }
function rWeighted(rng, weights) {
  let sum = 0; for (const w of weights) sum += w;
  if (sum <= 0) return 0;
  let x = rng() * sum;
  for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x < 0) return i; }
  return weights.length - 1;
}

/* ---------- music theory ---------- */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11], majPenta: [0, 2, 4, 7, 9], minPenta: [0, 3, 5, 7, 10]
};
function scalePitch(intervals, deg) { const L = intervals.length; const oct = Math.floor(deg / L); let idx = deg % L; if (idx < 0) idx += L; return 12 * oct + intervals[idx]; }
function pcToMidiNear(pc, ref) { return pc + 12 * Math.round((ref - pc) / 12); }
function chordPCs(rootPc, intervals, degree, useSeventh) {
  const stack = useSeventh ? [0, 2, 4, 6] : [0, 2, 4]; const pcs = [];
  for (const s of stack) pcs.push((rootPc + scalePitch(intervals, degree + s)) % 12);
  return pcs;
}
function chordRootPc(rootPc, intervals, degree) { return (rootPc + scalePitch(intervals, degree)) % 12; }
function chordLabel(rootPc, pcs) {
  const set = new Set(pcs.map(p => ((p - rootPc) % 12 + 12) % 12)); const has = n => set.has(n);
  const min3 = has(3), maj3 = has(4); let q = '';
  if (maj3 && has(7) && has(11)) q = 'maj7'; else if (maj3 && has(7) && has(10)) q = '7';
  else if (min3 && has(7) && has(10)) q = 'm7'; else if (min3 && has(6) && has(10)) q = 'm7b5';
  else if (min3 && has(6)) q = 'dim'; else if (maj3 && has(8)) q = 'aug';
  else if (min3) q = 'm'; else if (maj3) q = ''; else q = '5';
  return NOTE_NAMES[rootPc] + q;
}
// functional harmony transition weights, degrees 0..6 = I ii iii IV V vi vii
const HARM = [
  [0, 2, 1, 4, 4, 3, 1], [0, 0, 1, 2, 5, 1, 2], [1, 2, 0, 3, 1, 4, 0], [3, 3, 0, 0, 4, 1, 2],
  [6, 0, 0, 1, 0, 3, 0], [1, 4, 2, 4, 3, 0, 0], [6, 0, 2, 0, 0, 0, 0]
];
function nextDegree(rng, cur) { return rWeighted(rng, HARM[cur]); }

/* Euclidean rhythm (maximally even distribution of k hits over n steps), anchored so
   the first hit lands on step 0. This matters for dance music: E(4,16) is a proper
   four-on-the-floor (0,4,8,12), not a phase-shifted offbeat, so kicks and bass fall on
   the beat and the charter can place on-beat steps. rotate shifts the pattern after. */
function euclid(k, n, rotate) {
  k = Math.max(0, Math.min(n, k | 0)); const out = new Array(n).fill(0);
  if (k === 0) return out;
  for (let i = 0; i < n; i++) if (((i * k) % n) < k) out[i] = 1;
  if (rotate) { const r = ((rotate % n) + n) % n; return out.slice(n - r).concat(out.slice(0, n - r)); }
  return out;
}

/* ---------- moods: each a full sonic world (scales, tempo, timbre, fx) ---------- */
export const MOODS = {
  pulse: {
    label: 'PULSE', desc: 'dorian · driving', harmony: 'dorian', melody: 'dorian',
    tempo: [124, 132], swing: 0.06, useSeventh: true, chordBars: 2, drums: true, percMode: 'full',
    keys: [2, 4, 7, 9, 0], leadOct: 5, bassReg: [33, 45], padReg: [50, 66], arpReg: [60, 76], leadReg: [67, 83],
    voicesActiveBase: ['bass', 'pad', 'arp', 'lead'], arpUse: 1.0, counterPeak: true,
    fx: { reverb: 0.28, delay: 0.24, delayTime: '8d' },
    timbre: {
      pad: { osc: [['sawtooth', -6], ['sawtooth', 6], ['triangle', 0]], a: 0.6, d: 1.0, s: 0.55, r: 1.2, filter: 1300, fenv: 0.5, gain: 0.075, reverb: 0.45, delay: 0.05, pan: 0 },
      bass: { osc: [['sawtooth', 0], ['square', -12]], a: 0.005, d: 0.2, s: 0.5, r: 0.18, filter: 700, fenv: 0.7, gain: 0.30, reverb: 0.0, delay: 0 },
      arp: { osc: [['sawtooth', 0], ['square', 12]], a: 0.004, d: 0.14, s: 0.05, r: 0.12, filter: 2800, fenv: 0.7, gain: 0.12, reverb: 0.3, delay: 0.45 },
      lead: { osc: [['sawtooth', 0], ['sawtooth', 7], ['triangle', -12]], a: 0.01, d: 0.3, s: 0.5, r: 0.3, filter: 3000, fenv: 0.5, gain: 0.15, reverb: 0.35, delay: 0.3, vib: [5.5, 8] },
      counter: { osc: [['sawtooth', 0], ['triangle', 12]], a: 0.02, d: 0.3, s: 0.45, r: 0.4, filter: 2200, fenv: 0.4, gain: 0.09, reverb: 0.4, delay: 0.2 }
    }
  },
  circuit: {
    label: 'CIRCUIT', desc: 'minor · fast · hard', harmony: 'aeolian', melody: 'minPenta',
    tempo: [140, 160], swing: 0.08, useSeventh: true, chordBars: 1, drums: true, percMode: 'full',
    keys: [9, 4, 2, 7, 0], leadOct: 5, bassReg: [31, 43], padReg: [48, 64], arpReg: [57, 76], leadReg: [64, 83],
    voicesActiveBase: ['bass', 'pad', 'arp', 'lead'], arpUse: 1.0, counterPeak: true,
    fx: { reverb: 0.24, delay: 0.26, delayTime: '16d' },
    timbre: {
      pad: { osc: [['sawtooth', -8], ['sawtooth', 8]], a: 0.4, d: 0.8, s: 0.5, r: 0.9, filter: 1100, fenv: 0.55, gain: 0.065, reverb: 0.4, delay: 0.05, pan: 0 },
      bass: { osc: [['sawtooth', 0], ['square', -12]], a: 0.003, d: 0.15, s: 0.45, r: 0.12, filter: 780, fenv: 0.8, gain: 0.30, reverb: 0, delay: 0 },
      arp: { osc: [['square', 0], ['sawtooth', 12]], a: 0.003, d: 0.1, s: 0.05, r: 0.09, filter: 3200, fenv: 0.8, gain: 0.12, reverb: 0.26, delay: 0.4 },
      lead: { osc: [['sawtooth', 0], ['sawtooth', 7], ['square', -12]], a: 0.006, d: 0.22, s: 0.45, r: 0.22, filter: 3400, fenv: 0.6, gain: 0.15, reverb: 0.28, delay: 0.3, vib: [6, 9] },
      counter: { osc: [['sawtooth', 0], ['square', 12]], a: 0.01, d: 0.22, s: 0.45, r: 0.3, filter: 2400, fenv: 0.5, gain: 0.09, reverb: 0.3, delay: 0.2 }
    }
  },
  glass: {
    label: 'GLASS', desc: 'pentatonic · bright', harmony: 'ionian', melody: 'majPenta',
    tempo: [128, 140], swing: 0.06, useSeventh: true, chordBars: 2, drums: true, percMode: 'light',
    keys: [0, 2, 4, 7, 9], leadOct: 6, bassReg: [36, 48], padReg: [55, 72], arpReg: [67, 84], leadReg: [72, 89],
    voicesActiveBase: ['bass', 'pad', 'arp', 'lead'], arpUse: 1.0, counterPeak: true,
    fx: { reverb: 0.38, delay: 0.3, delayTime: '8d' },
    timbre: {
      pad: { osc: [['triangle', 0], ['sine', -7], ['triangle', 12]], a: 0.8, d: 1.2, s: 0.6, r: 1.4, filter: 1800, fenv: 0.4, gain: 0.075, reverb: 0.5, delay: 0.1, pan: 0 },
      bass: { osc: [['triangle', 0], ['sine', 0]], a: 0.01, d: 0.3, s: 0.55, r: 0.3, filter: 650, fenv: 0.4, gain: 0.26, reverb: 0.05, delay: 0 },
      arp: { osc: [['sine', 0], ['triangle', 19]], a: 0.003, d: 0.16, s: 0.0, r: 0.16, filter: 4000, fenv: 0.6, gain: 0.12, reverb: 0.4, delay: 0.5 },
      lead: { osc: [['sine', 0], ['triangle', 12]], a: 0.01, d: 0.3, s: 0.45, r: 0.4, filter: 4200, fenv: 0.4, gain: 0.14, reverb: 0.45, delay: 0.35, vib: [5, 6] },
      counter: { osc: [['sine', 0]], a: 0.02, d: 0.3, s: 0.4, r: 0.5, filter: 2600, fenv: 0.3, gain: 0.08, reverb: 0.5, delay: 0.3 }
    }
  },
  neon: {
    label: 'NEON', desc: 'minor · anthemic', harmony: 'aeolian', melody: 'aeolian',
    tempo: [128, 138], swing: 0.05, useSeventh: true, chordBars: 2, drums: true, percMode: 'full',
    keys: [9, 2, 4, 7, 11], leadOct: 5, bassReg: [33, 45], padReg: [50, 68], arpReg: [60, 78], leadReg: [67, 85],
    voicesActiveBase: ['bass', 'pad', 'arp', 'lead'], arpUse: 1.0, counterPeak: true,
    fx: { reverb: 0.34, delay: 0.28, delayTime: '8d' },
    timbre: {
      pad: { osc: [['sawtooth', -5], ['sawtooth', 7], ['sine', 0]], a: 0.7, d: 1.1, s: 0.6, r: 1.4, filter: 1500, fenv: 0.45, gain: 0.07, reverb: 0.5, delay: 0.08, pan: 0 },
      bass: { osc: [['sawtooth', 0], ['sine', -12]], a: 0.006, d: 0.22, s: 0.55, r: 0.2, filter: 720, fenv: 0.6, gain: 0.29, reverb: 0.0, delay: 0 },
      arp: { osc: [['square', 0], ['triangle', 12]], a: 0.004, d: 0.15, s: 0.05, r: 0.13, filter: 3000, fenv: 0.65, gain: 0.12, reverb: 0.35, delay: 0.45 },
      lead: { osc: [['sawtooth', 0], ['sawtooth', 12], ['triangle', -12]], a: 0.01, d: 0.32, s: 0.5, r: 0.35, filter: 3200, fenv: 0.5, gain: 0.16, reverb: 0.4, delay: 0.3, vib: [5, 7] },
      counter: { osc: [['sawtooth', 0], ['triangle', 12]], a: 0.02, d: 0.3, s: 0.45, r: 0.4, filter: 2200, fenv: 0.4, gain: 0.09, reverb: 0.42, delay: 0.2 }
    }
  }
};
export const MOOD_ORDER = ['pulse', 'neon', 'glass', 'circuit'];

/* ---------- composer ---------- */
const STEPS_PER_BAR = 16;

// Build sections filling a target bar count with a build-to-peak-then-resolve arc.
function buildArcSections(rng, totalBarsTarget, M) {
  const nSec = Math.max(4, Math.min(7, Math.round(totalBarsTarget / 8)));
  const peakIdx = rInt(rng, Math.floor(nSec * 0.45), nSec - 2);
  const per = Math.max(4, 4 * Math.round(totalBarsTarget / nSec / 4));
  const sections = [];
  let used = 0;
  for (let i = 0; i < nSec; i++) {
    let intensity;
    if (i <= peakIdx) intensity = 0.28 + 0.62 * (i / Math.max(1, peakIdx));
    else intensity = 0.9 - 0.62 * ((i - peakIdx) / Math.max(1, (nSec - 1 - peakIdx)));
    intensity = Math.max(0.18, Math.min(1, intensity + rFloat(rng, -0.06, 0.06)));
    let bars = (i === nSec - 1) ? Math.max(4, totalBarsTarget - used) : per + 4 * rInt(rng, -1, 1);
    bars = Math.max(4, bars);
    used += bars;
    sections.push(makeSection(rng, i, i, nSec, intensity, bars, M));
  }
  return sections;
}

// A short fixed-length block for the perpetual stream (one evolving phrase). Its
// array index is 0 (it is the only section), but its musical position drives the
// naming and the intro-sparseness rule, so a chunk is never treated as an intro.
function buildFixedSections(rng, bars, M, opts) {
  const base = opts.intensity != null ? opts.intensity : 0.72;
  const intensity = Math.max(0.3, Math.min(1, base + rFloat(rng, -0.08, 0.08)));
  return [makeSection(rng, 0, opts.sectionIndex || 1, 3, intensity, bars, M)];
}

// arrayIndex is the section's position in the sections array (what bars point at via
// sectionIndex); musicalPos is its place in the arc (naming + whether it is the intro).
function makeSection(rng, arrayIndex, musicalPos, nSec, intensity, bars, M) {
  const active = new Set(M.voicesActiveBase);
  if (intensity > 0.45 && rChance(rng, M.arpUse)) active.add('arp');
  if (intensity > 0.55) active.add('lead');
  if (intensity > 0.7 && M.counterPeak) active.add('counter');
  if (musicalPos === 0) { active.delete('counter'); if (!M.voicesActiveBase.includes('arp')) active.delete('arp'); }
  if (M.drums) {
    if (intensity > 0.3) active.add('kick');
    if (intensity > 0.45) active.add('hat');
    if (intensity > 0.55) active.add('snare');
    if (intensity > 0.75) active.add('perc');
  }
  return { index: arrayIndex, bars, intensity, active, name: pickSectionName(musicalPos, nSec, intensity, rng) };
}
function pickSectionName(i, n, intensity, rng) {
  if (i === 0) return 'INTRO';
  if (i === n - 1) return rChance(rng, 0.5) ? 'OUTRO' : 'RESOLVE';
  if (intensity >= 0.85) return 'PEAK';
  if (intensity >= 0.7) return rPick(rng, ['SWELL', 'RISE']);
  if (intensity <= 0.4) return rPick(rng, ['BREAK', 'DRIFT']);
  return rPick(rng, ['BUILD', 'STATE', 'TURN']);
}

export function composePiece(moodKey, seed, opts = {}) {
  const M = MOODS[moodKey] || MOODS.pulse;
  const rng = makeRng(seed);
  const harmInt = SCALES[M.harmony], melInt = SCALES[M.melody];
  const rootPc = (opts.rootPc != null) ? opts.rootPc : rPick(rng, M.keys);
  const tempo = (opts.bpm != null) ? Math.round(opts.bpm) : Math.round(rFloat(rng, M.tempo[0], M.tempo[1]));
  const density = (opts.density != null) ? opts.density : 55;
  const secPerBar = 4 * 60 / tempo;

  let sections;
  if (opts.bars != null) sections = buildFixedSections(rng, opts.bars, M, opts);
  else {
    const targetSeconds = opts.targetSeconds || 100;
    const totalBarsTarget = Math.max(8, Math.round(targetSeconds / secPerBar));
    sections = buildArcSections(rng, totalBarsTarget, M);
  }

  // chord timeline (per bar) via functional-harmony Markov, with cadences
  const chordBars = M.chordBars;
  const bars = [];
  let curDeg = (opts.evolveFrom && opts.evolveFrom.degree != null) ? nextDegree(rng, opts.evolveFrom.degree) : (rChance(rng, 0.6) ? 0 : 5);
  const isChunk = opts.bars != null;
  for (const sec of sections) {
    const nChords = Math.max(1, Math.floor(sec.bars / chordBars));
    if (sec.index > 0 && !isChunk) curDeg = rChance(rng, 0.5) ? 0 : rPick(rng, [5, 3, 1]);
    let laid = 0;
    for (let c = 0; c < nChords; c++) {
      const isLastSection = (sec.index === sections.length - 1) && !isChunk;
      if (isLastSection && c === nChords - 1) curDeg = 0;
      else if (isLastSection && c === nChords - 2) curDeg = rChance(rng, 0.6) ? 4 : 3;
      else if (c > 0 || sec.index > 0) curDeg = nextDegree(rng, curDeg);
      const pcs = chordPCs(rootPc, harmInt, curDeg, M.useSeventh);
      const crp = chordRootPc(rootPc, harmInt, curDeg);
      const label = chordLabel(crp, pcs);
      for (let b = 0; b < chordBars && laid < sec.bars; b++) { bars.push({ degree: curDeg, pcs, rootPc: crp, label, sectionIndex: sec.index, intensity: sec.intensity }); laid++; }
    }
    while (laid < sec.bars) { bars.push({ ...bars[bars.length - 1], sectionIndex: sec.index }); laid++; }
  }
  const totalBars = bars.length;
  const totalSteps = totalBars * STEPS_PER_BAR;

  const events = newEventMaps();
  const dmul = density / 55;
  genBass(events, M, rng, bars, sections, dmul);
  genPad(events, M, rng, bars, sections);
  genArp(events, M, rng, bars, sections, dmul);
  genLead(events, M, rng, bars, sections, melInt, rootPc, dmul);
  if (M.drums) genDrums(events, M, rng, bars, sections, dmul);

  const last = bars[bars.length - 1];
  const summary = { degree: last ? last.degree : 0, rootPc };
  return { moodKey, M, seed, density, tempo, secPerBar, rootPc, harmInt, melInt, sections, bars, totalBars, totalSteps, STEPS_PER_BAR, events, summary };
}

function newEventMaps() { return { bass: {}, pad: {}, arp: {}, lead: {}, counter: {}, kick: {}, snare: {}, hat: {}, perc: {} }; }
function addEv(map, step, ev) { (map[step] || (map[step] = [])).push(ev); }

function genBass(events, M, rng, bars, sections, dmul) {
  const SPB = 16;
  for (let bar = 0; bar < bars.length; bar++) {
    const b = bars[bar];
    if (!sections[b.sectionIndex].active.has('bass')) continue;
    const intensity = b.intensity;
    let hits = intensity > 0.7 ? rInt(rng, 4, 6) : intensity > 0.45 ? rInt(rng, 2, 4) : rInt(rng, 1, 2);
    hits = Math.max(1, Math.round(hits * Math.min(1.4, dmul)));
    const pat = euclid(hits, SPB, rInt(rng, 0, 2));
    const rootMidi = pcToMidiNear(b.rootPc, (M.bassReg[0] + M.bassReg[1]) / 2);
    let prev = -1;
    for (let s = 0; s < SPB; s++) {
      if (!pat[s]) continue;
      let midi = rootMidi;
      if (intensity > 0.55 && prev !== -1 && rChance(rng, 0.4)) midi = rootMidi + 7;
      if (intensity > 0.8 && rChance(rng, 0.2)) midi = rootMidi + 12;
      midi = Math.max(M.bassReg[0], Math.min(M.bassReg[1] + 12, midi));
      const dur = (s === 0 || intensity < 0.5) ? rInt(rng, 2, 4) : rInt(rng, 1, 2);
      addEv(events.bass, bar * SPB + s, { midi, dur, vel: 0.7 + 0.3 * intensity });
      prev = s;
    }
    if (bar === 0 || bars[bar - 1].label !== b.label) { if (!pat[0]) addEv(events.bass, bar * SPB, { midi: rootMidi, dur: 3, vel: 0.8 + 0.2 * intensity }); }
  }
}
function genPad(events, M, rng, bars, sections) {
  const SPB = 16, nVoices = M.useSeventh ? 4 : 3;
  let prevVoicing = null;
  for (let bar = 0; bar < bars.length; bar++) {
    const b = bars[bar];
    const changed = (bar === 0) || bars[bar - 1].label !== b.label || bars[bar - 1].sectionIndex !== b.sectionIndex;
    if (!changed) continue;
    let span = 1;
    while (bar + span < bars.length && bars[bar + span].label === b.label && bars[bar + span].sectionIndex === b.sectionIndex) span++;
    if (!sections[b.sectionIndex].active.has('pad')) { prevVoicing = null; continue; }
    const voicing = voiceLead(b.pcs, prevVoicing, M.padReg, nVoices);
    prevVoicing = voicing;
    addEv(events.pad, bar * SPB, { midis: voicing, dur: span * SPB - 1, vel: 0.6 + 0.35 * b.intensity });
  }
}
function voiceLead(pcs, prev, reg, nVoices) {
  const [lo, hi] = reg; const out = [];
  for (let i = 0; i < nVoices; i++) {
    const pc = pcs[i % pcs.length];
    let ref = (prev && prev[i] != null) ? prev[i] : lo + (i + 0.5) * ((hi - lo) / nVoices);
    let m = pcToMidiNear(pc, ref);
    while (m < lo) m += 12; while (m > hi) m -= 12;
    out.push(m);
  }
  let rootMidi = pcToMidiNear(pcs[0], lo + 3);
  while (rootMidi < lo) rootMidi += 12; while (rootMidi > hi) rootMidi -= 12;
  out[0] = rootMidi;
  return out;
}
function genArp(events, M, rng, bars, sections, dmul) {
  const SPB = 16, patterns = ['up', 'down', 'updown', 'converge', 'rwalk'];
  for (let bar = 0; bar < bars.length; bar++) {
    const b = bars[bar];
    if (!sections[b.sectionIndex].active.has('arp')) continue;
    const intensity = b.intensity;
    const pool = chordTonePool(b.pcs, M.arpReg);
    if (!pool.length) continue;
    let hits = intensity > 0.7 ? rInt(rng, 9, 13) : intensity > 0.5 ? rInt(rng, 6, 9) : rInt(rng, 4, 7);
    hits = Math.max(2, Math.min(15, Math.round(hits * dmul)));
    const gate = euclid(hits, SPB, rInt(rng, 0, 3));
    const pat = rPick(rng, patterns);
    let idx = 0, dir = 1;
    for (let s = 0; s < SPB; s++) {
      if (!gate[s]) continue;
      let pidx;
      if (pat === 'up') { pidx = idx % pool.length; idx++; }
      else if (pat === 'down') { pidx = (pool.length - 1 - (idx % pool.length)); idx++; }
      else if (pat === 'updown') { pidx = idx; idx += dir; if (idx >= pool.length - 1 || idx <= 0) dir *= -1; pidx = Math.max(0, Math.min(pool.length - 1, pidx)); }
      else if (pat === 'converge') { pidx = (idx % 2 === 0) ? (idx / 2) % pool.length : pool.length - 1 - (((idx - 1) / 2) % pool.length); idx++; }
      else { idx += rPick(rng, [-1, 1, 1, 2]); idx = ((idx % pool.length) + pool.length) % pool.length; pidx = idx; }
      addEv(events.arp, bar * SPB + s, { midi: pool[pidx % pool.length], dur: rChance(rng, 0.2) ? 2 : 1, vel: 0.5 + 0.4 * intensity });
    }
  }
}
function chordTonePool(pcs, reg) { const [lo, hi] = reg; const pool = []; for (let m = lo; m <= hi; m++) { if (pcs.includes(((m % 12) + 12) % 12)) pool.push(m); } return pool; }
function genLead(events, M, rng, bars, sections, melInt, rootPc, dmul) {
  const SPB = 16, L = melInt.length, [lo, hi] = M.leadReg;
  const baseMidi = 12 * M.leadOct + rootPc;
  function degMidi(d) { let m = baseMidi + scalePitch(melInt, d); while (m > hi) { d -= L; m = baseMidi + scalePitch(melInt, d); } while (m < lo) { d += L; m = baseMidi + scalePitch(melInt, d); } return { midi: m, d }; }
  function snapToChord(d, chordPcsSet) { for (let off = 0; off <= 4; off++) for (const sgn of [1, -1]) { const dd = d + off * sgn; const pc = ((baseMidi + scalePitch(melInt, dd)) % 12 + 12) % 12; if (chordPcsSet.has(pc)) return dd; } return d; }
  const deltaWeights = [2, 9, 9, 4, 4, 2, 2, 1, 1], deltaVals = [0, 1, -1, 2, -2, 3, -3, 4, -4];
  let d = rInt(rng, 2, 5);
  for (let bar = 0; bar < bars.length; bar++) {
    const sec = sections[bars[bar].sectionIndex];
    if (!sec.active.has('lead')) continue;
    const intensity = bars[bar].intensity;
    const inPhraseRestZone = (bar % 4 === 3);
    let s = 0;
    while (s < SPB) {
      const b = bars[bar], chordSet = new Set(b.pcs);
      const beatStrong = (s % 8 === 0), beatMed = (s % 4 === 0);
      let pOn = beatStrong ? 0.92 : beatMed ? 0.62 : 0.34;
      pOn *= (0.55 + 0.55 * intensity) * Math.min(1.5, dmul);
      if (inPhraseRestZone && s >= 8) pOn *= 0.25;
      if (rng() > pOn) { s += 1; continue; }
      let nd = d + deltaVals[rWeighted(rng, deltaWeights)];
      const cm = degMidi(nd).midi;
      if (cm > hi - 2 && rChance(rng, 0.6)) nd -= rInt(rng, 1, 2);
      if (cm < lo + 2 && rChance(rng, 0.6)) nd += rInt(rng, 1, 2);
      if (beatStrong || (beatMed && rChance(rng, 0.5))) nd = snapToChord(nd, chordSet);
      const dm = degMidi(nd); d = dm.d;
      const durW = beatStrong ? [0, 1, 3, 4, 3] : [0, 3, 3, 1, 0];
      let dur = rWeighted(rng, durW); if (dur < 1) dur = 1; dur = Math.min(dur, SPB - s);
      const vel = Math.max(0.3, Math.min(1, 0.55 + 0.4 * intensity + rFloat(rng, -0.05, 0.05)));
      addEv(events.lead, bar * SPB + s, { midi: dm.midi, dur, vel, deg: d });
      if (sec.active.has('counter') && intensity > 0.65) {
        let cm2 = baseMidi + scalePitch(melInt, d - 2);
        while (cm2 < lo - 12) cm2 += 12;
        addEv(events.counter, bar * SPB + s, { midi: cm2, dur, vel: Math.max(0.25, vel * 0.72) });
      }
      s += dur;
    }
  }
}
// A danceable dance kit, every hit on the grid so the pulse is unambiguous and the
// charter places on-beat steps. Four-on-the-floor kick (half-time when sparse), backbeat
// snare on 2 and 4, steady hats (8ths, 16ths at peak) with an offbeat open hat, and
// offbeat perc for lift. No euclidean/rotated kicks: syncopated kicks read as discordant
// and throw a player off their steps.
function genDrums(events, M, rng, bars, sections, dmul) {
  const SPB = 16;
  for (const sec of sections) {
    const its = sec.intensity;
    const fourOnFloor = its > 0.4;                 // else a half-time kick (beats 1 and 3)
    const hatStep = its > 0.7 ? 1 : 2;             // 16th hats when energetic, else 8ths
    const perc = its > 0.55;
    const startBar = cumulativeBars(sections, sec.index) - sec.bars;
    for (let bb = 0; bb < sec.bars; bb++) {
      const bar = startBar + bb;
      const lastBar = bb === sec.bars - 1;
      for (let s = 0; s < SPB; s++) {
        const step = bar * SPB + s;
        // kick: on every beat (or 1 and 3 when sparse); a lone pickup into the next phrase
        let kick = fourOnFloor ? (s % 4 === 0) : (s === 0 || s === 8);
        if (its > 0.7 && lastBar && s === 14 && rChance(rng, 0.5)) kick = true;
        if (sec.active.has('kick') && kick) addEv(events.kick, step, { vel: 0.86 + 0.14 * its });
        // snare/clap: backbeat on 2 and 4, with a simple on-grid end-of-phrase fill
        if (sec.active.has('snare') && (s === 4 || s === 12)) addEv(events.snare, step, { vel: 0.8 });
        if (sec.active.has('snare') && lastBar && its > 0.6 && (s === 14 || s === 15)) addEv(events.snare, step, { vel: 0.45 });
        // hats: steady, offbeat open hat for lift
        if (sec.active.has('hat') && s % hatStep === 0) addEv(events.hat, step, { vel: 0.3 + 0.22 * its, open: (s % 4 === 2 && rChance(rng, 0.2)) });
        // perc: offbeat eighths only, on the "and" of each beat
        if (sec.active.has('perc') && perc && s % 4 === 2) addEv(events.perc, step, { vel: 0.34 + 0.24 * its });
      }
    }
  }
}
function cumulativeBars(sections, idx) { let n = 0; for (let i = 0; i <= idx; i++) n += sections[i].bars; return n; }
