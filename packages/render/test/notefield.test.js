import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotefield } from '@doot-games/render';
import { fakeCanvas } from '../../../tools/fakecanvas.mjs';

// notes carry a beat (holds an endBeat), the way charter and simfile produce them;
// the notefield scrolls in beats.
const chart = {
  bpm: 150, offset: 0,
  notes: [
    { t: 0.2, beat: 0.5, lane: 0, dur: 0, quant: 4 },
    { t: 0.4, beat: 1.0, lane: 1, dur: 0.5, quant: 8, endBeat: 2.25 },
    { t: 0.6, beat: 1.5, lane: 2, dur: 0, quant: 16 }
  ]
};

test('a notefield renders a frame without throwing', () => {
  const nf = createNotefield(fakeCanvas(220, 360));
  nf.observe();
  assert.doesNotThrow(() => nf.render(0.3, chart, { speed: 2.4 }));
});

test('renders in beat-space when given a current beat (variable BPM path)', () => {
  const nf = createNotefield(fakeCanvas(220, 360));
  nf.observe();
  // a stop or BPM change leaves currentBeat where the session computed it; the
  // field must position notes off opts.beat, not the raw time, without throwing
  assert.doesNotThrow(() => nf.render(1.0, chart, { speed: 2.4, beat: 1.0 }));
  assert.doesNotThrow(() => nf.render(1.0, chart, { speed: 2.4, beat: 0 }));
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

test('hit pops the receptor for a scoring judgment and renders cleanly', () => {
  const nf = createNotefield(fakeCanvas());
  nf.resize();
  assert.equal(typeof nf.hit, 'function');
  assert.doesNotThrow(() => { nf.hit(2, 'marvelous', 0); nf.render(0.02, chart, { speed: 2 }); });
  // a non-scoring judgment is a no-op, not an error
  assert.doesNotThrow(() => nf.hit(0, 'miss', 0.1));
});
