# @doot-games/dsp

Pure signal-processing primitives. No audio context, no DOM. Every function
takes plain typed arrays, so the whole package is testable in isolation and
reusable outside this project.

## API

- `fft(re, im)` in-place iterative radix-2 FFT. `re` and `im` are `Float32Array` of length N (a power of two).
- `nextPow2(n)` smallest power of two at least `n`.
- `hannWindow(N)` returns a periodic Hann window as a `Float32Array`.
- `magnitudes(re, im, out?)` magnitude spectrum of the lower half of a transformed frame.
- `bandedFlux(mag, prev, loEnd, midEnd)` half-wave-rectified spectral flux split into low, mid, and high bands by bin index. Returns `{ flux, lo, mid, hi }`.
- `autocorr(signal, minLag, maxLag)` autocorrelation over an inclusive lag range, returned as a `Float64Array` indexed by lag.
- `parabolicShift(ym1, y0, yp1)` sub-sample peak refinement in `[-1, 1]`.

## Example

```js
import { fft, hannWindow, magnitudes } from '@doot-games/dsp';

const N = 1024;
const win = hannWindow(N);
const re = new Float32Array(N), im = new Float32Array(N);
for (let i = 0; i < N; i++) re[i] = sample(i) * win[i];
fft(re, im);
const mag = magnitudes(re, im);
```
