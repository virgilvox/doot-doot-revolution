import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '@doot-games/analysis';
import { generate, DIFFS } from '@doot-games/charter';
import { synthClicks } from '../../../tools/testutil.mjs';

function chartAt(diff) {
  const a = analyze(synthClicks(140, 12));
  const tp = { bpm: 140, offset: 0, fps: a.sr / a.hop };
  return generate(a, tp, { difficulty: diff, laneBias: 'drum', seed: 'test' });
}

test('density scales from easy to hard', () => {
  const easy = chartAt('basic'), hard = chartAt('challenge');
  assert.ok(hard.count >= easy.count, 'challenge (' + hard.count + ') should be at least as dense as basic (' + easy.count + ')');
});

test('charts spread across lanes and do not collapse onto one', () => {
  const c = chartAt('expert');
  const lanes = new Set(c.notes.map((n) => n.lane));
  assert.ok(lanes.size >= 3, 'expected at least 3 lanes used, got ' + lanes.size);
});

test('a seed makes generation deterministic', () => {
  const a = chartAt('difficult'), b = chartAt('difficult');
  assert.deepEqual(a.notes, b.notes);
});

test('beginner forbids jumps and jacks', () => {
  const c = chartAt('beginner');
  const single = c.notes;
  for (let i = 1; i < single.length; i++) {
    assert.ok(Math.abs(single[i].t - single[i - 1].t) > 1e-3, 'beginner should have no jumps (two notes at one time)');
    assert.notEqual(single[i].lane, single[i - 1].lane, 'beginner should alternate feet with no jacks');
  }
});

test('meter matches the difficulty foot rating', () => {
  const c = chartAt('expert');
  assert.equal(c.foot, DIFFS.expert.foot);
});
