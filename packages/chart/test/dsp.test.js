import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fft, hannWindow, magnitudes, autocorr, nextPow2, parabolicShift } from '@doot-games/chart';

test('nextPow2 rounds up to a power of two', () => {
  assert.equal(nextPow2(1000), 1024);
  assert.equal(nextPow2(1024), 1024);
});

test('hannWindow has the right length and tapers to zero at the edges', () => {
  const w = hannWindow(8);
  assert.equal(w.length, 8);
  assert.ok(w[0] < 1e-6);
  assert.ok(w[4] > 0.9);
});

test('fft of a pure tone peaks at its bin', () => {
  const N = 64, re = new Float32Array(N), im = new Float32Array(N), k = 4;
  for (let i = 0; i < N; i++) re[i] = Math.cos(2 * Math.PI * k * i / N);
  fft(re, im);
  const mag = magnitudes(re, im);
  let peak = 0; for (let i = 1; i < mag.length; i++) if (mag[i] > mag[peak]) peak = i;
  assert.equal(peak, k);
});

test('autocorr finds a periodic lag', () => {
  const n = 200, sig = new Float32Array(n), period = 10;
  for (let i = 0; i < n; i++) sig[i] = i % period === 0 ? 1 : 0;
  const ac = autocorr(sig, 2, 40);
  let best = 2; for (let lag = 2; lag <= 40; lag++) if (ac[lag] > ac[best]) best = lag;
  assert.ok(best % period === 0);
});

test('parabolicShift stays within one sample', () => {
  const s = parabolicShift(0.5, 1, 0.4);
  assert.ok(s >= -1 && s <= 1);
});
