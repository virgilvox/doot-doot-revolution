// dsp: pure signal-processing primitives. No audio context, no DOM. Everything
// here takes plain typed arrays so it is testable in isolation and reusable.

// In-place iterative radix-2 FFT. re and im are Float32Array of length N, N a
// power of two. Transformed in place.
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

// Periodic Hann window of length N. Periodic (dividing by N, not N-1) is the
// correct choice for STFT analysis, where frames tile the signal.
export function hannWindow(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  return w;
}

// Magnitude spectrum of the lower half of an already-transformed frame.
export function magnitudes(re, im, out) {
  const half = re.length >> 1;
  const m = out || new Float32Array(half);
  for (let k = 0; k < half; k++) m[k] = Math.hypot(re[k], im[k]);
  return m;
}

// Half-wave-rectified spectral flux split into three frequency bands. Rising
// magnitude bins (onsets) contribute; falling bins do not. Bin ranges are given
// as bin indices so the caller controls the Hz-to-bin mapping.
export function bandedFlux(mag, prev, loEnd, midEnd) {
  let flux = 0, lo = 0, mid = 0, hi = 0;
  const half = mag.length;
  for (let k = 1; k < half; k++) {
    const d = mag[k] - prev[k];
    if (d > 0) {
      flux += d;
      if (k < loEnd) lo += d; else if (k < midEnd) mid += d; else hi += d;
    }
  }
  return { flux, lo, mid, hi };
}

// Autocorrelation of a real signal over an inclusive lag range. Returns a
// Float64Array indexed by lag; entries below minLag are zero.
export function autocorr(signal, minLag, maxLag) {
  const out = new Float64Array(maxLag + 1);
  const n = signal.length;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    const limit = n - lag;
    for (let i = 0; i < limit; i++) s += signal[i] * signal[i + lag];
    out[lag] = limit > 0 ? s / limit : 0;
  }
  return out;
}

// Parabolic interpolation around a discrete peak. Returns the sub-sample shift
// in [-1, 1] to add to the peak index for a refined estimate.
export function parabolicShift(ym1, y0, yp1) {
  const den = ym1 - 2 * y0 + yp1;
  if (den === 0) return 0;
  const shift = 0.5 * (ym1 - yp1) / den;
  return Math.max(-1, Math.min(1, shift));
}
