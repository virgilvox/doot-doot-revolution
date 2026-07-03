// analysis: offline spectral analysis of a decoded buffer. Pure signal work over
// raw channel data, so it never touches the Web Audio graph and is testable with
// a synthesized buffer. Feeds the charter with an onset envelope, per band
// energy, and a tempo estimate.
//
// The pipeline follows the self-contained method proven in TREADLE: an FFT per
// frame, half-wave-rectified spectral flux split by band for the onset envelope,
// adaptive peak picking for discrete onsets, and autocorrelation of the envelope
// for tempo plus first beat offset.

import { fft, hannWindow, magnitudes, bandedFlux, autocorr, parabolicShift } from './dsp.js';

// Mix any buffer down to mono Float32. Accepts a Web Audio AudioBuffer or any
// object exposing numberOfChannels, length, and getChannelData(c).
function toMono(buffer) {
  const chans = buffer.numberOfChannels, len = buffer.length, mono = new Float32Array(len);
  for (let c = 0; c < chans; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += d[i] / chans;
  }
  return mono;
}

// Linear-interpolated downsample to a target rate. Cheaper and steadier onset
// analysis than working at the full rate.
function downsample(mono, srcSR, targetSR) {
  if (targetSR >= srcSR) return { sig: mono, sr: srcSR };
  const ratio = srcSR / targetSR, outLen = Math.floor(mono.length / ratio), sig = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const x = i * ratio, i0 = x | 0, f = x - i0;
    sig[i] = mono[i0] * (1 - f) + (mono[i0 + 1] || 0) * f;
  }
  return { sig, sr: targetSR };
}

export function analyze(buffer, opt = {}) {
  const N = opt.fftSize || 1024, hop = opt.hop || 512, targetSR = opt.sr || 22050;
  const mono = toMono(buffer);
  const { sig, sr } = downsample(mono, buffer.sampleRate, targetSR);

  const win = hannWindow(N);
  // Number of full windows that fit: floor((L-N)/hop)+1, so the last analyzable
  // frame is not dropped.
  const half = N >> 1, frames = sig.length >= N ? Math.floor((sig.length - N) / hop) + 1 : 0;
  const flux = new Float32Array(frames), bands = new Array(frames), env = new Float32Array(frames);
  const re = new Float32Array(N), im = new Float32Array(N);
  let prev = new Float32Array(half), mag = new Float32Array(half);
  const binHz = sr / N, loEnd = Math.max(1, Math.round(200 / binHz)), midEnd = Math.min(half, Math.round(2000 / binHz));

  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < N; i++) { re[i] = sig[off + i] * win[i]; im[i] = 0; }
    fft(re, im);
    magnitudes(re, im, mag);
    const b = bandedFlux(mag, prev, loEnd, midEnd);
    flux[f] = b.flux; bands[f] = { lo: b.lo, mid: b.mid, hi: b.hi };
    const t = prev; prev = mag; mag = t; // swap so prev holds this frame's spectrum
  }

  let mx = 1e-9; for (let f = 0; f < frames; f++) if (flux[f] > mx) mx = flux[f];
  for (let f = 0; f < frames; f++) env[f] = flux[f] / mx;

  const analysis = { sr, hop, N, frames, duration: buffer.duration, binHz, flux, env, bands, onsets: [] };
  analysis.onsets = pickOnsets(analysis);
  return analysis;
}

// Peak-pick onsets from the envelope with an adaptive local-mean threshold and a
// minimum gap. Returns onsets carrying their band energy for lane biasing.
export function pickOnsets(analysis, opt = {}) {
  const { env, bands, hop, sr } = analysis;
  const n = env.length, w = opt.window || 8, k = opt.k || 1.4, delta = opt.delta || 0.04, minGap = opt.minGap || 3;
  const out = []; let last = -1e9;
  for (let i = 1; i < n - 1; i++) {
    let s = 0, c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) { s += env[j]; c++; }
    const thr = (s / c) * k + delta;
    if (env[i] > thr && env[i] >= env[i - 1] && env[i] >= env[i + 1] && (i - last) >= minGap) {
      const band = bands[i] || { lo: 0, mid: 0, hi: 0 };
      out.push({ time: (i * hop) / sr, frame: i, strength: env[i], lo: band.lo, mid: band.mid, hi: band.hi });
      last = i;
    }
  }
  return out;
}

// BPM and first-beat offset via autocorrelation of the onset envelope. Reads env,
// hop, and sr from the analysis object. A gentle log-distance weight toward
// 128 BPM breaks octave ties the way most dance music sits.
export function estimateTempo(analysis, opt = {}) {
  const env = analysis.env, hop = analysis.hop, sr = analysis.sr;
  const minBpm = opt.min || 80, maxBpm = opt.max || 190, fps = sr / hop;
  const minLag = Math.max(2, Math.floor(fps * 60 / maxBpm)), maxLag = Math.ceil(fps * 60 / minBpm);

  let mean = 0; for (let i = 0; i < env.length; i++) mean += env[i]; mean /= (env.length || 1);
  const e = new Float32Array(env.length); for (let i = 0; i < env.length; i++) e[i] = env[i] - mean;

  const ac = autocorr(e, minLag, maxLag);
  let best = { score: -1, lag: minLag };
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = 60 * fps / lag, wgt = 1 - Math.min(1, Math.abs(Math.log2(bpm / 128)) * 0.15);
    const s = ac[lag] * wgt;
    if (s > best.score) best = { score: s, lag };
  }
  const shift = parabolicShift(ac[best.lag - 1] || 0, ac[best.lag], ac[best.lag + 1] || 0);
  let bpm = 60 * fps / (best.lag + shift);
  while (bpm < minBpm) bpm *= 2; while (bpm > maxBpm) bpm /= 2; bpm = Math.round(bpm * 10) / 10;

  const beatFrames = 60 * fps / bpm; let bo = { score: -1, off: 0 }; const steps = 48;
  for (let s = 0; s < steps; s++) {
    const phase = (s / steps) * beatFrames; let acc = 0, cnt = 0;
    for (let b = phase; b < e.length; b += beatFrames) { const fi = Math.round(b); if (fi < env.length) { acc += env[fi]; cnt++; } }
    const sc = cnt ? acc / cnt : 0; if (sc > bo.score) bo = { score: sc, off: phase };
  }
  return { bpm, offset: (bo.off * hop) / sr, fps };
}
