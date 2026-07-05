// composeChart: turn a composed PIECE directly into a game step-chart, per
// difficulty. Because we know every musical onset exactly (kick/snare/bass/arp/
// lead on the 16-step grid), this is more reliable than charting from noisy audio
// onsets: steps fall precisely on the music. Difficulty scaling reuses the DIFFS
// table (allowed subdivisions, notes-per-second cap, jump/hold probabilities, foot
// meter) so composed charts line up with the ones the audio charter produces.

import { makeRng, mixSeed } from './compose.js';
import { DIFFS, pickPanel } from './charter.js';
import { computeRadar } from './radar.js';

// which voices feed arrows at each difficulty (denser tiers add melodic layers)
const LAYERS = {
  beginner: ['kick', 'snare', 'bass'],
  basic: ['kick', 'snare', 'bass'],
  difficult: ['kick', 'snare', 'bass', 'arp'],
  expert: ['kick', 'snare', 'bass', 'arp', 'lead'],
  challenge: ['kick', 'snare', 'bass', 'arp', 'lead', 'counter']
};
const DIFF_ORDER = ['beginner', 'basic', 'difficult', 'expert', 'challenge'];

// finest subdivision a step sits on: 1=quarter, 2=eighth, 4=sixteenth (our grid
// has no triplets, so only these three occur).
function stepSub(s) { return s % 4 === 0 ? 1 : s % 2 === 0 ? 2 : 4; }
function stepQuant(s) { return s % 4 === 0 ? 4 : s % 2 === 0 ? 8 : 16; }

export function chartFromPiece(piece, difficulty, opts = {}) {
  const D = DIFFS[difficulty] || DIFFS.basic;
  const layers = LAYERS[difficulty] || LAYERS.basic;
  const rng = makeRng(mixSeed(piece.seed, DIFF_ORDER.indexOf(difficulty) + 1));
  const SPB = piece.STEPS_PER_BAR, ev = piece.events;
  const bpm = piece.tempo, spb = 60 / bpm;               // seconds per beat
  const dur = piece.totalBars * 4 * spb;
  // lead-in: no arrow before this many seconds, so the first steps are visible scrolling
  // in rather than sitting on the receptor at t=0 where they can never be hit
  const leadInBeat = (opts.leadIn || 0) / spb;

  // 1) gather candidate onsets (a step allowed by this tier's subdivisions that
  //    carries at least one onset from an active layer)
  const cands = [];
  for (let bar = 0; bar < piece.totalBars; bar++) {
    for (let s = 0; s < SPB; s++) {
      if (!D.subs.includes(stepSub(s))) continue;
      if (bar * 4 + s / 4 < leadInBeat) continue;        // hold arrows until the lead-in passes
      const step = bar * SPB + s;
      let strength = 0, hit = false, hasKick = false, hasSnare = false, hasHi = false;
      for (const v of layers) {
        const arr = ev[v] && ev[v][step];
        if (!arr) continue;
        hit = true;
        for (const e of arr) strength += (e.vel || 0.6);
        if (v === 'kick') hasKick = true;
        if (v === 'snare') hasSnare = true;
        if (v === 'lead' || v === 'arp' || v === 'counter') hasHi = true;
      }
      if (!hit) continue;
      cands.push({ step, s, beat: bar * 4 + s / 4, strength, hasKick, hasSnare, hasHi, strong: s % 8 === 0, med: s % 4 === 0 });
    }
  }

  // 2) gate density by subdivision coverage (tempo-independent). Quarters always pass;
  //    eighths and sixteenths pass at the tier's coverage. Below full coverage,
  //    sixteenths are kept only in runs (a neighbor sixteenth present) so Expert reads as
  //    bursts, not isolated gallops. A fixed nps cap fails here: at high tempo it drops
  //    every sixteenth and Expert collapses onto Difficult.
  const candSteps = new Set(cands.map((c) => c.step));
  const inRun = (c) => candSteps.has(c.step - 1) || candSteps.has(c.step + 1);
  const covered = cands.filter((c) => {
    const sub = stepSub(c.s);
    if (sub === 1) return true;                                   // quarters
    if (sub === 2) return D.eighth >= 1 || rng() < D.eighth;      // eighths
    if (D.sixteenth <= 0) return false;                           // no sixteenths this tier
    if (D.sixteenth >= 1) return true;                            // full sixteenth streams
    return inRun(c) && rng() < (0.55 + 0.45 * D.sixteenth);       // Expert: sixteenth bursts
  });
  // 3) light safety thin: the 16-step grid already spaces onsets by a sixteenth, so this
  //    only catches an accidental sub-32nd overlap from a pathological piece.
  const minDt = 1 / Math.max(D.maxNps, 13);
  const pri = (c) => c.strength + (c.strong ? 2 : c.med ? 1 : 0);
  const kept = [];
  for (const c of covered) {
    const prev = kept[kept.length - 1];
    if (!prev || (c.beat - prev.beat) * spb >= minDt) kept.push(c);
    else if (pri(c) > pri(prev)) kept[kept.length - 1] = c;
  }

  // 3) assign lanes (strict foot alternation) with jumps on strong kick+snare
  //    coincidences and holds off sustained lead notes
  const notes = [];
  let lastFoot = -1, lastPanel = -1, prevPanel = -1;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  for (const c of kept) {
    const t = c.beat * spb, quant = stepQuant(c.s), mid = pitchAt(ev, c.step, piece.rootPc);
    // a jump (two arrows at once) on a beat carrying a kick or snare, at the tier's
    // rate. Kick is four-on-the-floor and snare is on 2 & 4, so this actually fires
    // (the old kick-AND-snare-on-a-strong-beat test never coincided) and the higher
    // tiers' larger jumpProb makes them denser and more technical than the lower ones.
    if (c.med && (c.hasKick || c.hasSnare) && rng() < D.jumpProb) {
      notes.push({ ...mkNote(t, c.beat, pick([0, 1]), quant), midi: mid }, { ...mkNote(t, c.beat, pick([2, 3]), quant), midi: mid });
      lastFoot = -1; lastPanel = -1; prevPanel = -1;
      continue;
    }
    // strict foot alternation through the shared pickPanel, so composed charts get the
    // same home-side bias plus the tier's controlled crossover and footswitch variety as
    // the audio charter (the old rigid side-flip made patterns predictable). Pseudo band
    // energy from the voices present keeps lanes tracking the kit: kick low -> Down,
    // snare mid, lead/arp high -> Up.
    const r = { lo: c.hasKick ? 1 : 0.25, mi: c.hasSnare ? 1 : 0.3, hi: c.hasHi ? 1 : 0.25 };
    const allowRepeat = rng() < D.footswitch;
    const foot = lastFoot === 0 ? 1 : (lastFoot === 1 ? 0 : (rng() < 0.5 ? 0 : 1));
    const lane = pickPanel(foot, lastPanel, prevPanel, r, rng, D, allowRepeat, true);
    let n = mkNote(t, c.beat, lane, quant); n.midi = mid;
    if ((difficulty === 'expert' || difficulty === 'challenge')) {
      const lead = ev.lead && ev.lead[c.step];
      if (lead && lead[0].dur >= 4 && rng() < D.holdProb) {
        const beats = lead[0].dur / 4;
        n = { ...n, dur: beats * spb, type: 'hold', endBeat: c.beat + beats };
      }
    }
    notes.push(n);
    prevPanel = lastPanel; lastPanel = lane; lastFoot = foot;
  }

  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  const chart = {
    bpm, offset: 0, bpms: [{ beat: 0, bpm }], stops: [], difficulty,
    foot: D.foot, meter: D.foot, duration: dur, engine: 'compose', engineUsed: 'composed',
    notes, count: notes.length
  };
  chart.radar = computeRadar(chart);
  return chart;
}

function mkNote(t, beat, lane, quant) { return { t, beat, lane, dur: 0, quant, type: 'tap' }; }

// the musical pitch to sound when a step is hit: the melody if there is one, else the arp,
// counter, bass, chord top, or the tonic. Lets the hit feedback play the song's own notes.
function pitchAt(ev, step, rootPc) {
  let m = null;
  for (const v of ['lead', 'arp', 'counter', 'bass']) { const a = ev[v] && ev[v][step]; if (a && a.length && a[0].midi != null) { m = a[0].midi; break; } }
  if (m == null) { const pad = ev.pad && ev.pad[step]; m = (pad && pad.length && pad[0].midis && pad[0].midis.length) ? pad[0].midis[pad[0].midis.length - 1] : 60 + (rootPc || 0); }
  // fold into a pleasant ~2 octaves (A3..C6) so hit plucks stay smooth, no jarring low bass
  while (m < 57) m += 12; while (m > 84) m -= 12;
  return m;
}
