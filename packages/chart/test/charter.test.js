import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '@doot-games/chart';
import { generate, DIFFS, createTiming } from '@doot-games/chart';
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

test('createTiming: constant tempo maps beats to seconds and back', () => {
  const t = createTiming({ offset: 0.5, bpm: 120 }); // 0.5 s/beat
  assert.equal(t.beatToTime(0), 0.5);
  assert.equal(t.beatToTime(4), 0.5 + 2);
  assert.ok(Math.abs(t.timeToBeat(2.5) - 4) < 1e-9);
});

test('createTiming: a BPM change speeds the later beats', () => {
  // 120 bpm (0.5 s/beat) for beats 0..4, then 240 bpm (0.25 s/beat)
  const t = createTiming({ offset: 0, bpms: [{ beat: 0, bpm: 120 }, { beat: 4, bpm: 240 }] });
  assert.equal(t.beatToTime(4), 2);          // 4 * 0.5
  assert.equal(t.beatToTime(8), 2 + 1);      // + 4 * 0.25
  assert.ok(Math.abs(t.timeToBeat(3) - 8) < 1e-9);
});

test('createTiming: a stop freezes the beat for its duration', () => {
  // stop of 1 second at beat 4, constant 120 bpm
  const t = createTiming({ offset: 0, bpm: 120, stops: [{ beat: 4, seconds: 1 }] });
  assert.equal(t.beatToTime(4), 2);          // arrival before the stop
  assert.equal(t.beatToTime(5), 2 + 1 + 0.5); // after the 1 s stop, one more beat
  // during the stop window [2, 3] the beat stays at 4
  assert.equal(t.timeToBeat(2.5), 4);
  assert.ok(Math.abs(t.timeToBeat(3.5) - 5) < 1e-9);
});

test('createTiming: a BPM change and a stop at the same beat compose', () => {
  // 120 bpm to beat 4, then 240 bpm, with a 0.5 s stop at beat 4
  const t = createTiming({ offset: 0, bpms: [{ beat: 0, bpm: 120 }, { beat: 4, bpm: 240 }], stops: [{ beat: 4, seconds: 0.5 }] });
  assert.equal(t.beatToTime(4), 2);          // arrival, before the stop
  assert.equal(t.beatToTime(6), 3);          // 2 + 0.5 stop + 2 * 0.25 at 240 bpm
});

test('createTiming: a lead-in offset delays beat 0 and beats before it extrapolate', () => {
  const t = createTiming({ offset: 1.5, bpm: 120 }); // beat 0 sounds 1.5 s in
  assert.equal(t.beatToTime(0), 1.5);
  assert.equal(t.beatToTime(2), 2.5);
  assert.equal(t.timeToBeat(1.5), 0);
  assert.ok(Math.abs(t.timeToBeat(0.5) - (-2)) < 1e-9); // 1 s before beat 0 is beat -2
});
