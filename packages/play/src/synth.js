// synth: a live subtractive Web-Audio voice set (ported from the ferrule engine)
// that plays a composed PIECE in real time. Detuned oscillators run through a filter
// with an envelope and an amplitude ADSR into a dry bus plus per-voice reverb and
// tempo-synced feedback delay; drums are dedicated one-shots. Only the currently
// sounding voices ever exist, so even dense dance music is cheap to play (unlike an
// offline bounce, which pays for every node across the whole song). The engine's
// lookahead scheduler drives scheduleStep; the same voices serve finite built-in
// songs and the endless perpetual stream. Takes a PIECE as plain data, so this stays
// free of the composer.

function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
export function pieceStepDur(piece) { return 60 / piece.tempo / 4; }
export function pieceDuration(piece) { return piece.totalSteps * pieceStepDur(piece); }

function makeSoftClipCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}
function makeReverbIR(ctx, seconds, decay) {
  const rate = ctx.sampleRate, len = Math.max(1, Math.floor(seconds * rate)), buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) { const t = i / len; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * (0.6 + 0.4 * Math.sin(i * 0.0007 + ch)); } }
  return buf;
}
function makeNoiseBuffer(ctx) { const len = ctx.sampleRate * 1.0, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; return buf; }
function delayTimeSeconds(bpm, mode) { const beat = 60 / bpm; if (mode === '4d') return beat * 1.5; if (mode === '16d') return beat * 0.375; return beat * 0.75; }

// Build the synth signal chain feeding `destination` (the engine's music bus). The
// returned object carries the send nodes, an output gain (for fades), a noise
// buffer, and dispose() to tear it all down.
export function createSynthChain(ctx, M, tempo, destination, opts = {}) {
  const dry = !!opts.dry;
  const out = ctx.createGain(); out.gain.value = opts.gain != null ? opts.gain : 1;
  const softclip = ctx.createWaveShaper(); softclip.curve = makeSoftClipCurve(2.0); softclip.oversample = '2x';
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -16; compressor.knee.value = 24; compressor.ratio.value = 3.2; compressor.attack.value = 0.004; compressor.release.value = 0.18;
  compressor.connect(softclip); softclip.connect(out); out.connect(destination);

  const conv = ctx.createConvolver(); conv.buffer = makeReverbIR(ctx, dry ? 1.1 : 2.2, 2.5);
  const reverbReturn = ctx.createGain(); reverbReturn.gain.value = (dry ? 0.6 : 1) * M.fx.reverb;
  const reverbSend = ctx.createGain(); reverbSend.gain.value = 1;
  reverbSend.connect(conv); conv.connect(reverbReturn); reverbReturn.connect(compressor);

  const delaySend = ctx.createGain(); delaySend.gain.value = 1;
  const delayNode = ctx.createDelay(2.0); delayNode.delayTime.value = delayTimeSeconds(tempo, M.fx.delayTime);
  const delayFb = ctx.createGain(); delayFb.gain.value = 0.4;
  const delayFilter = ctx.createBiquadFilter(); delayFilter.type = 'lowpass'; delayFilter.frequency.value = 2400;
  const delayReturn = ctx.createGain(); delayReturn.gain.value = M.fx.delay;
  delaySend.connect(delayNode); delayNode.connect(delayFilter); delayFilter.connect(delayFb); delayFb.connect(delayNode);
  delayFilter.connect(delayReturn); delayReturn.connect(compressor);

  return {
    compressor, reverbSend, delaySend, out, noise: makeNoiseBuffer(ctx), M, swing: M.swing || 0,
    fadeIn(sec) { const t = ctx.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(opts.gain != null ? opts.gain : 1, t + sec); },
    dispose(fade) {
      const t = ctx.currentTime;
      if (fade > 0) { try { out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0.0001, t + fade); } catch (e) {} }
      const kill = () => { try { out.disconnect(); reverbReturn.disconnect(); delayReturn.disconnect(); compressor.disconnect(); } catch (e) {} };
      if (fade > 0) setTimeout(kill, (fade + 0.1) * 1000); else kill();
    }
  };
}

function playSynth(ctx, B, time, midi, durSec, T, globalGain) {
  const freq = mtof(midi), out = ctx.createGain(), amp = ctx.createGain(), filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  const cutoff = T.filter || 2000, fenv = T.fenv || 0; filter.Q.value = 0.8 + (T.q || 0);
  const t0 = time;
  if (fenv > 0) {
    filter.frequency.setValueAtTime(Math.max(80, cutoff * (1 - fenv * 0.7)), t0);
    filter.frequency.linearRampToValueAtTime(cutoff, t0 + Math.min(0.08, (T.a || 0.01) + 0.04));
    filter.frequency.linearRampToValueAtTime(Math.max(120, cutoff * (0.5 + 0.5 * (T.s || 0.5))), t0 + durSec * 0.7 + 0.2);
  } else filter.frequency.value = cutoff;
  filter.connect(amp);
  const pan = ctx.createStereoPanner(); pan.pan.value = T.pan != null ? T.pan : 0; amp.connect(pan); pan.connect(out);
  out.connect(B.compressor);
  if (T.reverb) { const rg = ctx.createGain(); rg.gain.value = T.reverb; out.connect(rg); rg.connect(B.reverbSend); }
  if (T.delay) { const dg = ctx.createGain(); dg.gain.value = T.delay; out.connect(dg); dg.connect(B.delaySend); }
  const peak = (T.gain || 0.12) * globalGain, a = Math.max(0.003, T.a || 0.01), dcy = Math.max(0.01, T.d || 0.1), sus = (T.s != null ? T.s : 0.5), rel = Math.max(0.03, T.r || 0.2), tOff = t0 + Math.max(durSec, a + 0.02);
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(peak, t0 + a);
  amp.gain.linearRampToValueAtTime(peak * sus, t0 + a + dcy);
  amp.gain.setValueAtTime(Math.max(0.0001, peak * sus), Math.max(t0 + a + dcy, tOff));
  amp.gain.linearRampToValueAtTime(0.0001, tOff + rel);
  let lfoGain = null, lfo = null;
  if (T.vib) { lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = T.vib[0]; lfoGain = ctx.createGain(); lfoGain.gain.value = T.vib[1]; lfo.connect(lfoGain); lfo.start(t0); lfo.stop(tOff + rel + 0.05); }
  const oscs = [];
  for (const [type, det] of T.osc) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = det; if (lfoGain) lfoGain.connect(o.detune); o.connect(filter); o.start(t0); o.stop(tOff + rel + 0.05); oscs.push(o); }
  oscs[oscs.length - 1].onended = () => { try { oscs.forEach(o => o.disconnect()); if (lfo) { lfo.disconnect(); lfoGain.disconnect(); } filter.disconnect(); amp.disconnect(); pan.disconnect(); out.disconnect(); } catch (e) {} };
}
function playKick(ctx, B, time, vel) {
  const o = ctx.createOscillator(); o.type = 'sine'; const amp = ctx.createGain();
  o.frequency.setValueAtTime(160, time); o.frequency.exponentialRampToValueAtTime(46, time + 0.11);
  amp.gain.setValueAtTime(Math.max(0.0001, vel * 0.9), time); amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
  o.connect(amp); amp.connect(B.compressor); o.start(time); o.stop(time + 0.24);
  const c = ctx.createOscillator(); c.type = 'triangle'; c.frequency.value = 900; const ca = ctx.createGain();
  ca.gain.setValueAtTime(vel * 0.25, time); ca.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
  c.connect(ca); ca.connect(B.compressor); c.start(time); c.stop(time + 0.03);
  o.onended = () => { try { o.disconnect(); amp.disconnect(); c.disconnect(); ca.disconnect(); } catch (e) {} };
}
function playSnare(ctx, B, time, vel) {
  const src = ctx.createBufferSource(); src.buffer = B.noise;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7; const amp = ctx.createGain();
  amp.gain.setValueAtTime(Math.max(0.0001, vel * 0.5), time); amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  src.connect(bp); bp.connect(amp); amp.connect(B.compressor);
  const rg = ctx.createGain(); rg.gain.value = 0.2; amp.connect(rg); rg.connect(B.reverbSend);
  src.start(time); src.stop(time + 0.2);
  const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = 185; const ba = ctx.createGain();
  ba.gain.setValueAtTime(vel * 0.3, time); ba.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  b.connect(ba); ba.connect(B.compressor); b.start(time); b.stop(time + 0.14);
  src.onended = () => { try { src.disconnect(); bp.disconnect(); amp.disconnect(); rg.disconnect(); b.disconnect(); ba.disconnect(); } catch (e) {} };
}
function playHat(ctx, B, time, vel, open) {
  const src = ctx.createBufferSource(); src.buffer = B.noise;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200; const amp = ctx.createGain(); const dur = open ? 0.18 : 0.035;
  amp.gain.setValueAtTime(Math.max(0.0001, vel * 0.4), time); amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(hp); hp.connect(amp); amp.connect(B.compressor); src.start(time); src.stop(time + dur + 0.02);
  src.onended = () => { try { src.disconnect(); hp.disconnect(); amp.disconnect(); } catch (e) {} };
}
function playPerc(ctx, B, time, vel) {
  const o = ctx.createOscillator(); o.type = 'triangle';
  o.frequency.setValueAtTime(420, time); o.frequency.exponentialRampToValueAtTime(190, time + 0.08);
  const amp = ctx.createGain(); amp.gain.setValueAtTime(Math.max(0.0001, vel * 0.35), time); amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 1.2;
  o.connect(bp); bp.connect(amp); amp.connect(B.compressor);
  const rg = ctx.createGain(); rg.gain.value = 0.3; amp.connect(rg); rg.connect(B.reverbSend);
  o.start(time); o.stop(time + 0.14);
  o.onended = () => { try { o.disconnect(); bp.disconnect(); amp.disconnect(); rg.disconnect(); } catch (e) {} };
}

// Fire all voice events for one 16th-step of a piece at audio time `time`.
export function scheduleStep(ctx, B, piece, step, time) {
  const ev = piece.events, T = piece.M.timbre, stepDur = pieceStepDur(piece);
  const t = time + ((step % 2 === 1) ? B.swing * stepDur : 0);
  let arr;
  if ((arr = ev.bass[step])) for (const e of arr) playSynth(ctx, B, t, e.midi, e.dur * stepDur, T.bass, e.vel);
  if ((arr = ev.pad[step])) for (const e of arr) for (const m of e.midis) playSynth(ctx, B, t, m, e.dur * stepDur, T.pad, e.vel * 0.9);
  if ((arr = ev.arp[step])) for (const e of arr) playSynth(ctx, B, t, e.midi, e.dur * stepDur, T.arp, e.vel);
  if ((arr = ev.lead[step])) for (const e of arr) playSynth(ctx, B, t, e.midi, e.dur * stepDur, T.lead, e.vel);
  if ((arr = ev.counter[step])) for (const e of arr) playSynth(ctx, B, t, e.midi, e.dur * stepDur, T.counter, e.vel);
  if ((arr = ev.kick[step])) for (const e of arr) playKick(ctx, B, t, e.vel);
  if ((arr = ev.snare[step])) for (const e of arr) playSnare(ctx, B, t, e.vel);
  if ((arr = ev.hat[step])) for (const e of arr) playHat(ctx, B, t, e.vel, e.open);
  if ((arr = ev.perc[step])) for (const e of arr) playPerc(ctx, B, t, e.vel);
}
