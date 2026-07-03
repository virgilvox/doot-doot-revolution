import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '@doot-games/play';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; }

test('defaults bind the arrow keys to the four lanes', () => {
  const input = createInput({ storage: fakeStorage() });
  const b = input.bindings();
  assert.equal(b.lanes.length, 4);
  assert.equal(input.describe(0), 'Left');
  assert.equal(input.describe(3), 'Right');
});

test('lane state starts up and pad is enabled by default', () => {
  const input = createInput({ storage: fakeStorage() });
  assert.deepEqual(input.laneDown(), [false, false, false, false]);
  assert.equal(input.isDown(0), false);
  assert.equal(input.padEnabled(), true);
  input.setPadEnabled(false);
  assert.equal(input.padEnabled(), false);
});

test('reset restores defaults after a change is persisted', () => {
  const storage = fakeStorage();
  const input = createInput({ storage });
  input.listen(0);
  input.cancelListen();
  input.reset();
  assert.equal(input.describe(0), 'Left');
});

test('poll is a no-op without a gamepad API', () => {
  const input = createInput({ storage: fakeStorage() });
  assert.doesNotThrow(() => input.poll());
});
