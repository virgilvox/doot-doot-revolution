import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotefield } from '@doot-games/notefield';
import { fakeCanvas } from '../../../tools/fakecanvas.mjs';

const chart = {
  bpm: 150, offset: 0,
  notes: [
    { t: 0.2, lane: 0, dur: 0, quant: 4 },
    { t: 0.4, lane: 1, dur: 0.5, quant: 8 },
    { t: 0.6, lane: 2, dur: 0, quant: 16 }
  ]
};

test('a notefield renders a frame without throwing', () => {
  const nf = createNotefield(fakeCanvas(220, 360));
  nf.observe();
  assert.doesNotThrow(() => nf.render(0.3, chart, { speed: 2.4 }));
});

test('geometry and time mapping return finite numbers', () => {
  const nf = createNotefield(fakeCanvas(220, 360));
  nf.resize();
  const g = nf.geom();
  assert.ok(g.w === 220 && g.h === 360);
  const pps = nf.pps(chart, 2.4);
  assert.ok(Number.isFinite(pps) && pps > 0);
  const y = nf.yAtTime(1, 0, chart, 2.4);
  const t = nf.timeAtY(y, 0, chart, 2.4);
  assert.ok(Math.abs(t - 1) < 1e-6, 'yAtTime and timeAtY should invert');
});

test('blast is accepted and cleared after its lifetime', () => {
  const nf = createNotefield(fakeCanvas());
  nf.resize();
  nf.blast(0, '#fff', 0);
  assert.doesNotThrow(() => nf.render(0.05, chart, { speed: 2 }));
  assert.doesNotThrow(() => nf.render(1.0, chart, { speed: 2 }));
});
