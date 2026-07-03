// composeChart: turn a composed PIECE directly into a game step-chart, per
// difficulty. Because we know every musical onset exactly (kick/snare/bass/arp/
// lead on the 16-step grid), this is more reliable than charting from noisy audio
// onsets: steps fall precisely on the music. Difficulty scaling reuses the DIFFS
// table (allowed subdivisions, notes-per-second cap, jump/hold probabilities, foot
// meter) so composed charts line up with the ones the audio charter produces.

import { makeRng, mixSeed } from './compose.js';
import { DIFFS } from './charter.js';
import { computeRadar } from './radar.js';

// which voices feed arrows at each difficulty (denser tiers add melodic layers)
const LAYERS = {
  beginner: ['kick', 'snare'],
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

export function chartFromPiece(piece, difficulty) {
  const D = DIFFS[difficulty] || DIFFS.basic;
  const layers = LAYERS[difficulty] || LAYERS.basic;
  const rng = makeRng(mixSeed(piece.seed, DIFF_ORDER.indexOf(difficulty) + 1));
  const SPB = piece.STEPS_PER_BAR, ev = piece.events;
  const bpm = piece.tempo, spb = 60 / bpm;               // seconds per beat
  const dur = piece.totalBars * 4 * spb;

  // 1) gather candidate onsets (a step allowed by this tier's subdivisions that
  //    carries at least one onset from an active layer)
  const cands = [];
  for (let bar = 0; bar < piece.totalBars; bar++) {
    for (let s = 0; s < SPB; s++) {
      if (!D.subs.includes(stepSub(s))) continue;
      const step = bar * SPB + s;
      let strength = 0, hit = false, hasKick = false, hasSnare = false;
      for (const v of layers) {
        const arr = ev[v] && ev[v][step];
        if (!arr) continue;
        hit = true;
        for (const e of arr) strength += (e.vel || 0.6);
        if (v === 'kick') hasKick = true;
        if (v === 'snare') hasSnare = true;
      }
      if (!hit) continue;
      cands.push({ step, s, beat: bar * 4 + s / 4, strength, hasKick, hasSnare, strong: s % 8 === 0, med: s % 4 === 0 });
    }
  }

  // 2) cap density to the tier's notes-per-second, keeping the strongest/most
  //    on-beat candidates
  const maxNotes = Math.max(1, Math.floor(D.maxNps * dur));
  let kept = cands;
  if (cands.length > maxNotes) {
    const pri = (c) => c.strength + (c.strong ? 2 : c.med ? 1 : 0);
    kept = cands.slice().sort((a, b) => pri(b) - pri(a)).slice(0, maxNotes).sort((a, b) => a.step - b.step);
  }

  // 3) assign lanes (strict foot alternation) with jumps on strong kick+snare
  //    coincidences and holds off sustained lead notes
  const notes = [];
  let side = 0, lastLane = -1;
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  for (const c of kept) {
    const t = c.beat * spb, quant = stepQuant(c.s);
    if (c.hasKick && c.hasSnare && c.strong && rng() < D.jumpProb) {
      notes.push(mkNote(t, c.beat, pick([0, 1]), quant), mkNote(t, c.beat, pick([2, 3]), quant));
      side = 0; lastLane = -1;
      continue;
    }
    side ^= 1;
    const lanes = side ? [2, 3] : [0, 1];
    let lane = pick(lanes);
    if (lane === lastLane) lane = lanes[(lanes.indexOf(lane) + 1) % 2];
    let n = mkNote(t, c.beat, lane, quant);
    if ((difficulty === 'expert' || difficulty === 'challenge')) {
      const lead = ev.lead && ev.lead[c.step];
      if (lead && lead[0].dur >= 4 && rng() < D.holdProb) {
        const beats = lead[0].dur / 4;
        n = { ...n, dur: beats * spb, type: 'hold', endBeat: c.beat + beats };
      }
    }
    notes.push(n);
    lastLane = lane;
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
