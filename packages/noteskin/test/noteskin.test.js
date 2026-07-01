import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowSVG, colorFor, shade, QUANT, DIR, LANE_ROT, LANE_DIRS, drawArrow } from '@doot-games/noteskin';
import { fakeCtx } from '../../../tools/fakecanvas.mjs';

test('lane order and rotations are the DDR standard', () => {
  assert.deepEqual(LANE_DIRS, ['left', 'down', 'up', 'right']);
  assert.deepEqual(LANE_ROT, [-90, 180, 0, 90]);
});

test('colorFor falls back to the 4th color for unknown keys', () => {
  assert.deepEqual(colorFor(4), QUANT[4]);
  assert.deepEqual(colorFor('left'), DIR.left);
  assert.deepEqual(colorFor(999), QUANT[4]);
});

test('shade returns an rgba string', () => {
  const s = shade('#FF0000', -30, 0.8);
  assert.match(s, /^rgba\(\d+,\d+,\d+,0\.8\)$/);
});

test('arrowSVG builds a rotated gradient arrow', () => {
  const svg = arrowSVG('up', 8);
  assert.match(svg, /^<svg /);
  assert.ok(svg.includes('linearGradient'));
  assert.ok(svg.includes('rotate(0 256 256)'));
});

test('drawArrow no-ops without Path2D instead of throwing', () => {
  assert.doesNotThrow(() => drawArrow(fakeCtx(), 10, 10, 40, 4, 0, {}));
});
