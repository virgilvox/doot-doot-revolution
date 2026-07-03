import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, estimateTempo } from '@doot-games/chart';
import { synthClicks } from '../../../tools/testutil.mjs';

test('analyze returns an envelope, bands, and onsets', () => {
  const a = analyze(synthClicks(128, 8));
  assert.ok(a.frames > 0);
  assert.equal(a.env.length, a.frames);
  assert.equal(a.bands.length, a.frames);
  assert.ok(a.onsets.length > 8, 'should find several onsets in an 8s click track');
});

test('estimateTempo recovers a known BPM', () => {
  const a = analyze(synthClicks(128, 10));
  const t = estimateTempo(a);
  assert.ok(Math.abs(t.bpm - 128) < 6, 'expected ~128, got ' + t.bpm);
});

test('estimateTempo recovers a second BPM', () => {
  const a = analyze(synthClicks(150, 10));
  const t = estimateTempo(a);
  assert.ok(Math.abs(t.bpm - 150) < 6, 'expected ~150, got ' + t.bpm);
});
