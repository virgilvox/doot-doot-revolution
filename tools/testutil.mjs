// Test helper: a deterministic synthesized click track with a known BPM, shaped
// like a Web Audio AudioBuffer so the analysis and charter packages can run over
// it in Node with no audio hardware.

export function synthClicks(bpm = 128, secs = 8, sr = 22050) {
  const len = Math.floor(secs * sr), d = new Float32Array(len), beat = 60 / bpm;
  const bars = Math.ceil(secs / beat);
  function kick(t0) { const i0 = Math.floor(t0 * sr); for (let k = 0; k < sr * 0.15 && i0 + k < len; k++) { const t = k / sr; d[i0 + k] += Math.sin(2 * Math.PI * (90 * Math.exp(-t * 20) + 50) * t) * Math.exp(-t * 10) * 0.9; } }
  function hat(t0) { const i0 = Math.floor(t0 * sr); for (let k = 0; k < sr * 0.03 && i0 + k < len; k++) { const t = k / sr; d[i0 + k] += Math.sin(2 * Math.PI * 8000 * t) * Math.exp(-t * 80) * 0.3; } }
  for (let b = 0; b < bars; b++) { const t = b * beat; kick(t); hat(t + beat / 2); if (b % 2) hat(t); }
  for (let i = 0; i < len; i++) d[i] = Math.max(-1, Math.min(1, d[i]));
  return { sampleRate: sr, length: len, numberOfChannels: 1, duration: secs, getChannelData: () => d };
}
