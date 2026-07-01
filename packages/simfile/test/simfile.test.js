import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSM, parseSM, toPackage, parsePackage } from '@doot-games/simfile';

const chart = {
  bpm: 120, offset: 0, difficulty: 'expert', meter: 12,
  notes: [
    { t: 0.5, beat: 1, lane: 0, dur: 0, quant: 4, type: 'tap' },
    { t: 1.0, beat: 2, lane: 2, dur: 0, quant: 8, type: 'tap' },
    { t: 1.5, beat: 3, lane: 1, dur: 0.5, quant: 4, type: 'hold', endBeat: 4 }
  ]
};

test('a chart round trips through .sm', () => {
  const sm = toSM(chart);
  assert.ok(sm.includes('dance-single'));
  assert.ok(sm.includes('#BPMS:0.000=120.000'));
  const back = parseSM(sm);
  assert.equal(back.notes.length, 3);
  const lanes = back.notes.map((n) => n.lane).sort();
  assert.deepEqual(lanes, [0, 1, 2]);
  const hold = back.notes.find((n) => n.dur > 0);
  assert.ok(hold, 'hold should survive');
  assert.equal(hold.lane, 1);
  assert.equal(Math.round(hold.endBeat), 4);
});

test('note beats are preserved to the grid', () => {
  const back = parseSM(toSM(chart));
  const beats = back.notes.map((n) => Math.round(n.beat)).sort();
  assert.deepEqual(beats, [1, 2, 3]);
});

test('the native package round trips', () => {
  const rec = { id: 'x', title: 'Test', artist: 'A', bpm: 120, offset: 0, source: 'file', duration: 10, createdAt: 1, charts: { expert: chart } };
  const r2 = parsePackage(toPackage(rec));
  assert.equal(r2.title, 'Test');
  assert.equal(r2.charts.expert.notes.length, 3);
  assert.equal(r2.bpm, 120);
});
