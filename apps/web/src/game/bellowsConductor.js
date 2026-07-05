// Live bellows playback for composed songs, both in-game and as the select-wheel
// preview, so a song sounds the same before and after you pick it. One Bellows boots on
// the engine's shared AudioContext and plays a composed PIECE in realtime through its
// worklet, from code, with no pre-render and no loading pause. Its output is routed
// through the engine's music bus (so the volume settings apply and we can fade), and the
// engine adopts bellows' transport start as the song clock so judge and renderer stay
// synced.

import { Bellows } from 'bellowsjs';
import { engine } from './singletons.js';
import { buildRack, presetForGenre, presetForMood, DRUM_PITCH } from './bellowsRacks.js';

let _boot = null;   // cached boot promise (worklet loads once)
let _gain = null;   // fade node between bellows and the engine music bus
let _buses = null;  // shared reverb + delay sends, created once and reused by every rack

export function bootBellows() {
  if (!_boot) _boot = Bellows.boot({ context: engine.ensure() }).then((b) => {
    // route bellows through the engine music bus via a gain we can ramp for fades
    _gain = b.ctx.createGain(); _gain.gain.value = 1;
    try { b.analyser.disconnect(); } catch (e) {}
    b.analyser.connect(_gain); _gain.connect(engine.music);
    // one reverb and one delay for the whole session (the kernel has no removeBus, so a
    // fresh pair per song would leak); racks vary only the per-voice send amounts
    _buses = {
      verb: b.bus([['fdn', { size: 1.1, decay: 1.7, damp: 4200, mix: 1 }]], { level: 0.9 }),
      delay: b.bus([['tapeDelay', { time: 0.26, feedback: 0.32, mix: 1 }]], { level: 0.8 })
    };
    return b;
  });
  return _boot;
}

function setGain(v, ramp, ctx) {
  if (!_gain) return;
  const t = ctx.currentTime, val = Math.max(0.0001, v);
  try {
    _gain.gain.cancelScheduledValues(t);
    _gain.gain.setValueAtTime(Math.max(0.0001, _gain.gain.value), t);
    if (ramp > 0) _gain.gain.linearRampToValueAtTime(val, t + ramp); else _gain.gain.setValueAtTime(val, t);
  } catch (e) {}
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

const stepSecs = (piece) => piece.secPerBar / piece.STEPS_PER_BAR;
const durSecs = (piece) => (d) => Math.max(0.05, (d || 1) * stepSecs(piece) * 0.94);

let _current = null;          // { unsub, b }
let _pendingFinalize = null;  // { fn, timer } deferred stop during a fade-out

function finalizeNow() {
  if (!_pendingFinalize) return;
  clearTimeout(_pendingFinalize.timer);
  try { _pendingFinalize.fn(); } catch (e) {}
  _pendingFinalize = null;
}

// Play a composed PIECE live for the game. Returns { startAt, duration } so the caller
// can adopt the engine clock. Assumes bellows is booted (warm it during the countdown).
export async function playPieceLive(piece, genre) {
  const b = await bootBellows();
  stopLive();
  b.panic();
  setGain(1, 0, b.ctx);
  const rack = buildRack(b, presetForGenre(genre), _buses);
  const dsec = durSecs(piece), ev = piece.events, total = piece.totalSteps;
  const unsub = b.clock.at('16n', (t, step) => { if (step < total) scheduleStep(rack, ev, step, t, dsec); });
  b.bpm(piece.tempo);
  const t0 = b.ctx.currentTime;
  b.start(); // transport beat 0 lands at ~t0 + 0.05
  _current = { unsub, b, channels: rack.channels };
  return { startAt: t0 + 0.05, duration: total * stepSecs(piece) };
}

// Faded, looping preview of a PIECE for the select wheel, same rack as playback.
export async function previewPieceLive(piece, genre, { fromStep = 0, fadeIn = 0.4, level = 0.9, preset = null } = {}) {
  const b = await bootBellows();
  stopLive();
  if (b.ctx.state === 'suspended') b.ctx.resume();
  b.panic();
  const rack = buildRack(b, preset || presetForGenre(genre), _buses);
  const dsec = durSecs(piece), ev = piece.events, total = piece.totalSteps;
  const span = Math.max(16, total - fromStep); // loop the hook-to-end window
  const unsub = b.clock.at('16n', (t, step) => { scheduleStep(rack, ev, fromStep + (step % span), t, dsec); });
  setGain(0.0001, 0, b.ctx);
  b.bpm(piece.tempo);
  b.start();
  setGain(level, fadeIn, b.ctx);
  _current = { unsub, b, preview: true, channels: rack.channels };
}

// Stop the current live run. With fade > 0, ramp the output down first (a smooth preview
// crossfade); otherwise cut immediately.
export function stopLive(fade = 0) {
  finalizeNow();
  if (!_current) return;
  const c = _current; _current = null;
  const fin = () => {
    try { c.unsub(); } catch (e) {}
    try { c.b.stop(); c.b.panic(); } catch (e) {}
    // remove this rack's channels so the kernel stops processing them every audio block
    if (c.channels) for (const id of c.channels) { try { c.b.structural({ type: 'removeChannel', id }); } catch (e) {} }
  };
  if (fade > 0 && _gain && c.b) {
    setGain(0.0001, fade, c.b.ctx);
    _pendingFinalize = { fn: fin, timer: setTimeout(() => { _pendingFinalize = null; fin(); }, (fade + 0.06) * 1000) };
  } else {
    fin();
  }
}

// Play the endless conductor's growing piece live. The conductor keeps composing and
// charting bars ahead; the clock callback schedules whatever events exist at each step as
// the transport reaches them. Returns { startAt } for the engine clock and stepOf() so the
// caller can prune events behind the transport.
export async function playEndlessLive(cond, mood) {
  const b = await bootBellows();
  stopLive();
  b.panic();
  setGain(1, 0, b.ctx);
  const rack = buildRack(b, presetForMood(mood), _buses);
  const piece = cond.piece;
  const dsec = durSecs(piece);
  let cur = 0;
  const unsub = b.clock.at('16n', (t, step) => { cur = step; scheduleStep(rack, piece.events, step, t, dsec); });
  b.bpm(cond.tempo);
  const t0 = b.ctx.currentTime;
  b.start();
  _current = { unsub, b, channels: rack.channels };
  return { startAt: t0 + 0.05, stepOf: () => cur };
}

export function isLive() { return !!_current; }
