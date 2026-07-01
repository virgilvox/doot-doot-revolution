# @doot-games/analysis

Offline spectral analysis of a decoded audio buffer. Pure signal work over raw
channel data, so it never touches the Web Audio graph and can run against a
synthesized buffer in a test. Depends only on `@doot-games/dsp`.

## API

### `analyze(buffer, opts?)`

Takes a Web Audio `AudioBuffer` or any object exposing `numberOfChannels`,
`length`, `sampleRate`, `duration`, and `getChannelData(c)`. Returns:

```
{
  sr, hop, N, frames, duration, binHz,
  flux,           // raw spectral flux per frame
  env,            // normalized onset strength envelope per frame
  bands,          // per frame { lo, mid, hi } energy
  onsets          // peak-picked [{ time, frame, strength, lo, mid, hi }]
}
```

Options: `fftSize` (default 1024), `hop` (default 512), `sr` target rate for
analysis (default 22050).

### `pickOnsets(analysis, opts?)`

Adaptive local-mean peak picking over the envelope. Returns the onset list. Used
internally by `analyze`, exposed for reuse. Options: `window`, `k`, `delta`,
`minGap`.

### `estimateTempo(analysis, opts?)`

Autocorrelation of the onset envelope for BPM and first-beat offset. Returns
`{ bpm, offset, fps }` with `offset` in seconds. A gentle weight toward 128 BPM
breaks octave ties. Options: `min` and `max` BPM bounds.

## Method

FFT per frame, half-wave-rectified spectral flux split by band for the onset
envelope, adaptive peak picking for discrete onsets, and autocorrelation of the
envelope for tempo. This is the method proven in TREADLE, ported to the shared
`dsp` primitives. An essentia.js WASM backend can be added behind this same
interface later as an accuracy upgrade; it is an internal backend, not a user
facing engine.
