# @doot-games/chart

The audio-to-chart domain, as one framework-agnostic workspace package. Private to
this repo (not published). Pure logic (the stem path feature-detects and no-ops off
the browser), so it tests in Node with `node --test`.

Members, each a file under `src/` re-exported from `index.js`:

- **dsp** FFT, Hann window, spectral flux, autocorrelation.
- **analysis** onset envelope, per-band energy, and tempo estimation from an
  AudioBuffer-like object.
- **charter** deterministic step-chart generation, plus `createTiming`, the
  beat/second map that honors BPM changes and stops.
- **pipeline** the chart-engine router (Quick, Drum-Aware, Stem-Split). Its
  `generate` is exported as `generateFromAudio`, since `charter` also exports a
  `generate`.
- **simfile** read and write StepMania `.sm`/`.ssc` and the native `.ddr` package.
- **radar** the five-axis groove radar (`computeRadar`, `radarSVG`, `AXES`).
- **stems** optional WebGPU drum isolation, feature-detected.
