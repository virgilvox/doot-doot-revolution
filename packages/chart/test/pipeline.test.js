import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '@doot-games/chart';
import { generateFromAudio as generate } from '@doot-games/chart';
import { synthClicks } from '../../../tools/testutil.mjs';

function source() {
  const analysis = analyze(synthClicks(132, 10));
  return { analysis, tempo: { bpm: 132, offset: 0, fps: analysis.sr / analysis.hop }, title: 'song' };
}

test('quick engine reports the quick path', async () => {
  const out = await generate(source(), { engine: 'quick', difficulties: ['basic', 'expert'] });
  assert.ok(out.charts.basic && out.charts.expert);
  assert.ok(out.engineUsed.startsWith('quick'), out.engineUsed);
});

test('drum engine reports drum-aware', async () => {
  const out = await generate(source(), { engine: 'drum', difficulty: 'expert' });
  assert.equal(out.engineUsed, 'drum-aware');
});

test('stem engine falls back when WebGPU is unavailable and says so', async () => {
  const out = await generate(source(), { engine: 'stem', difficulty: 'basic' });
  assert.ok(out.engineUsed.includes('fallback'), 'expected a fallback label, got ' + out.engineUsed);
  assert.ok(out.charts.basic.count >= 0);
});
