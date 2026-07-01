import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBus, createSettings } from '@doot-games/core';

test('bus delivers events and unsubscribes', () => {
  const bus = createBus();
  let n = 0; const off = bus.on('x', (d) => { n += d; });
  bus.emit('x', 2); bus.emit('x', 3);
  off(); bus.emit('x', 4);
  assert.equal(n, 5);
});

test('bus once fires a single time', () => {
  const bus = createBus();
  let n = 0; bus.once('y', () => { n++; });
  bus.emit('y'); bus.emit('y');
  assert.equal(n, 1);
});

test('a throwing handler does not break the emit', () => {
  const bus = createBus();
  let reached = false;
  bus.on('z', () => { throw new Error('boom'); });
  bus.on('z', () => { reached = true; });
  bus.emit('z');
  assert.ok(reached);
});

test('settings read, write, persist, and notify', () => {
  const store = new Map();
  const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  let changed = null;
  const s = createSettings({ defaults: { speed: 2.4 }, storage });
  s.onChange((c) => { changed = c; });
  assert.equal(s.get('speed'), 2.4);
  s.set('speed', 3);
  assert.equal(s.get('speed'), 3);
  assert.equal(changed.value, 3);

  const s2 = createSettings({ defaults: { speed: 2.4 }, storage });
  assert.equal(s2.get('speed'), 3, 'a new instance reads persisted state');

  s2.reset();
  assert.equal(s2.get('speed'), 2.4);
});
