import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRadar, AXES } from '@doot-games/chart';

test('computeRadar returns every axis in the unit range', () => {
  const chart = {
    bpm: 150, foot: 12, duration: 10,
    notes: [
      { t: 0, lane: 0, dur: 0, quant: 16 }, { t: 0, lane: 3, dur: 0, quant: 16 },
      { t: 0.5, lane: 1, dur: 1, quant: 8 }, { t: 1, lane: 2, dur: 0, quant: 4 }
    ]
  };
  const r = computeRadar(chart);
  for (const [k] of AXES) { assert.ok(r[k] >= 0 && r[k] <= 1, k + ' out of range: ' + r[k]); }
  assert.ok(r.air > 0, 'a jump should register on the air axis');
  assert.ok(r.freeze > 0, 'a hold should register on the freeze axis');
});
