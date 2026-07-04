// Render a composed PIECE (from @doot-games/chart composePiece) to an AudioBuffer
// through bellowsjs: real synth engines and effects instead of the built-in
// subtractive synth. Offline render (a plain DSP loop, no AudioWorklet), so it runs
// the same in the web app and the packaged desktop app with no CSP concerns. The
// musical content (harmony, arrangement, per-voice step events) is unchanged; only
// the sound is bellows'. The game chart still derives from the same PIECE.

import { Bellows } from 'bellowsjs';

// Map each PIECE voice to a bellows engine + a starting patch. Kept intentionally
// modest; the mood's own fx levels shape the space. Engine param names that a given
// engine ignores are harmless.
function buildVoices(b, M) {
  const v = {};
  v.bass = b.voice('va', { shape: 1, cutoff: 620, resonance: 0.35 }).gain(0.42);
  v.pad = b.voice('va', { shape: 0, cutoff: 1500, resonance: 0.18, detune: 9 }, { polyphony: 6 }).gain(0.16);
  v.arp = b.voice('pluck', { damping: 0.45, brightness: 0.6 }).gain(0.20);
  v.lead = b.voice('fm', { algorithm: 3, ratio: 2, feedback: 0.28 }).gain(0.22);
  v.counter = b.voice('va', { shape: 0, cutoff: 1200, resonance: 0.2, detune: 6 }, { polyphony: 3 }).gain(0.12);
  v.kick = b.voice('kick', { tune: 48, decay: 0.32, punch: 0.7 }).gain(0.9);
  v.snare = b.voice('snare', { decay: 0.18, tone: 0.5 }).gain(0.5);
  v.hat = b.voice('hat', { decay: 0.05 }).gain(0.28);
  v.perc = b.voice('clap', { decay: 0.14 }).gain(0.34);
  return v;
}

export async function renderPieceBellows(piece, ctx) {
  const b = await Bellows.boot({ context: ctx, seed: String(piece.seed || 'doot'), bpm: piece.tempo });
  try {
    const M = piece.M || {};
    const v = buildVoices(b, M);

    // space: a reverb send and a tape delay send, at the mood's levels
    const fx = M.fx || {};
    const verb = b.bus(['fdn'], { level: Math.min(0.5, fx.reverb ?? 0.3) });
    const delay = b.bus([['tapeDelay', { time: 0.24, feedback: 0.34 }]], { level: Math.min(0.5, fx.delay ?? 0.22) });
    v.pad.send(verb, 0.55);
    v.arp.send(verb, 0.35).send(delay, 0.4);
    v.lead.send(verb, 0.4).send(delay, 0.32);
    v.counter.send(verb, 0.45);
    v.snare.send(verb, 0.18);

    // master glue so the mix sits together and never clips
    b.masterFx(['compressor', { threshold: -13, ratio: 3, attack: 0.005, release: 0.16 }], ['limiter', { ceiling: -0.6 }]);
    b.masterGain(0.92);

    const stepDur = piece.secPerBar / piece.STEPS_PER_BAR; // seconds per 16th step
    const dsec = (dSteps) => Math.max(0.05, (dSteps || 1) * stepDur * 0.94);
    const ev = piece.events;

    // one clock callback drives the whole piece; bellows re-runs it under the
    // offline transport, so the render is exactly what a live pass would play
    b.clock.at('16n', (t, step) => {
      const at = t;
      const pitched = (name, inst) => { const l = ev[name][step]; if (l) for (const e of l) inst.note(e.midi, { at, dur: { seconds: dsec(e.dur) }, vel: e.vel }); };
      const chords = (name, inst) => { const l = ev[name][step]; if (l) for (const e of l) inst.chord(e.midis, { at, dur: { seconds: dsec(e.dur) }, vel: e.vel }); };
      const drum = (name, inst, pitch) => { const l = ev[name][step]; if (l) for (const e of l) inst.note(pitch, { at, vel: e.vel }); };
      pitched('bass', v.bass);
      chords('pad', v.pad);
      pitched('arp', v.arp);
      pitched('lead', v.lead);
      pitched('counter', v.counter);
      drum('kick', v.kick, 36);
      drum('snare', v.snare, 38);
      drum('hat', v.hat, 42);
      drum('perc', v.perc, 39);
    });

    const tail = 2.2; // let reverb ring past the last note
    const seconds = piece.totalBars * piece.secPerBar + tail;
    const audio = await b.render({ seconds });
    const buf = ctx.createBuffer(2, audio.left.length, audio.sampleRate);
    buf.copyToChannel(audio.left, 0);
    buf.copyToChannel(audio.right, 1);
    return buf;
  } finally {
    b.dispose();
  }
}
