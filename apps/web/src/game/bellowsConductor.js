// Live bellows playback for composed songs. Boots one Bellows on the engine's shared
// AudioContext and plays a composed PIECE in realtime through its AudioWorklet, from
// code, with no pre-render and no loading pause. The engine still owns the song clock
// (adoptClock) so the judge and renderer read one clock; we start bellows' transport at
// the same instant so audio and steps stay in sync.

import { Bellows } from 'bellowsjs';
import { engine } from './singletons.js';
import { buildRack, presetForGenre, DRUM_PITCH } from './bellowsRacks.js';

let _boot = null; // cached boot promise (worklet loads once)
export function bootBellows() {
  if (!_boot) _boot = Bellows.boot({ context: engine.ensure() });
  return _boot;
}

// schedule one 16th step's events onto the rack's voices at tick time t
function scheduleStep(rack, ev, step, t, dsec) {
  const V = rack.voices;
  const pitched = (name, inst) => { const l = ev[name][step]; if (l && inst) for (const e of l) inst.note(e.midi, { at: t, dur: { seconds: dsec(e.dur) }, vel: e.vel }); };
  const chords = (name, inst) => { const l = ev[name][step]; if (l && inst) for (const e of l) inst.chord(e.midis, { at: t, dur: { seconds: dsec(e.dur) }, vel: e.vel }); };
  const drum = (name, inst) => { const l = ev[name][step]; if (l && inst) for (const e of l) inst.note(DRUM_PITCH[name], { at: t, vel: e.vel }); };
  pitched('bass', V.bass);
  chords('pad', V.pad);
  pitched('arp', V.arp);
  pitched('lead', V.lead);
  pitched('counter', V.counter);
  drum('kick', V.kick);
  drum('snare', V.snare);
  drum('hat', V.hat);
  drum('perc', V.perc);
}

let _current = null; // { unsub, b }

// Play a composed PIECE live. Returns { startAt, duration } so the caller can adopt the
// engine clock. Assumes bellows is already booted (call bootBellows() during the countdown).
export async function playPieceLive(piece, genre) {
  const b = await bootBellows();
  stopLive();
  b.panic();
  const rack = buildRack(b, presetForGenre(genre));
  const stepDur = piece.secPerBar / piece.STEPS_PER_BAR;
  const dsec = (d) => Math.max(0.05, (d || 1) * stepDur * 0.94);
  const ev = piece.events;
  const total = piece.totalSteps;
  const unsub = b.clock.at('16n', (t, step) => {
    if (step >= total) return; // finite song: nothing to schedule past the end
    scheduleStep(rack, ev, step, t, dsec);
  });
  b.bpm(piece.tempo);
  const t0 = b.ctx.currentTime;
  b.start(); // transport beat 0 lands at ~t0 + 0.05
  _current = { unsub, b };
  return { startAt: t0 + 0.05, duration: total * stepDur };
}

export function stopLive() {
  if (!_current) return;
  const c = _current; _current = null;
  try { c.unsub(); } catch (e) {}
  try { c.b.stop(); c.b.panic(); } catch (e) {}
}

export function isLive() { return !!_current; }
