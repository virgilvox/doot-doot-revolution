import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultBindings, defaultKeyboard, defaultPad, padDeviceKey, laneFor, setBinding,
  ensurePad, loadBindings, saveBindings, migrateV1, describeSlot
} from '@doot-games/play';

function fakeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
}

test('default bindings: keyboard arrows, no pads yet', () => {
  const b = defaultBindings();
  assert.deepEqual(b.keyboard.lanes, [['ArrowLeft'], ['ArrowDown'], ['ArrowUp'], ['ArrowRight']]);
  assert.deepEqual(b.pads, {});
});

test('default pad maps the d-pad to the four lanes', () => {
  const p = defaultPad();
  assert.equal(laneFor(p, 14), 0); // left
  assert.equal(laneFor(p, 13), 1); // down
  assert.equal(laneFor(p, 12), 2); // up
  assert.equal(laneFor(p, 15), 3); // right
  assert.equal(laneFor(p, 0), -1); // unmapped face button
});

test('padDeviceKey extracts a stable vendor:product key across index/reconnect', () => {
  const id = 'Xbox 360 Controller (STANDARD GAMEPAD Vendor: 045e Product: 028e)';
  assert.equal(padDeviceKey({ id, index: 0 }), '045e:028e');
  assert.equal(padDeviceKey({ id, index: 3 }), '045e:028e');
});

test('padDeviceKey falls back to a normalized id and separates types', () => {
  const k = padDeviceKey({ id: 'Some Dance Pad (STANDARD GAMEPAD)' });
  assert.ok(k.length > 0);
  assert.ok(!/[()]/.test(k)); // parenthetical noise stripped
  assert.notEqual(k, padDeviceKey({ id: 'Other Pad' }));
});

test('laneFor resolves keyboard codes', () => {
  const kb = defaultKeyboard();
  assert.equal(laneFor(kb, 'ArrowLeft'), 0);
  assert.equal(laneFor(kb, 'ArrowRight'), 3);
  assert.equal(laneFor(kb, 'KeyZ'), -1);
});

test('setBinding replaces a lane and a slot', () => {
  const kb = defaultKeyboard();
  setBinding(kb, 0, 'KeyA');
  assert.equal(laneFor(kb, 'KeyA'), 0);
  assert.equal(laneFor(kb, 'ArrowLeft'), -1); // old binding replaced
  setBinding(kb, 'start', 'Space');
  assert.deepEqual(kb.start, ['Space']);
});

test('ensurePad creates a default map once, then returns the same object', () => {
  const b = defaultBindings();
  const p = ensurePad(b, '045e:028e');
  assert.equal(laneFor(p, 14), 0);
  setBinding(ensurePad(b, '045e:028e'), 0, 7);
  assert.equal(laneFor(ensurePad(b, '045e:028e'), 7), 0); // persisted on the same object
  assert.equal(Object.keys(b.pads).length, 1);
});

test('save then load round-trips (v2)', () => {
  const store = fakeStorage();
  const b = defaultBindings();
  setBinding(b.keyboard, 0, 'KeyH');
  ensurePad(b, 'aa:bb');
  saveBindings(store, b);
  const loaded = loadBindings(store);
  assert.equal(laneFor(loaded.keyboard, 'KeyH'), 0);
  assert.ok(loaded.pads['aa:bb']);
});

test('migrateV1 keeps keyboard keys and drops device-less pad binds', () => {
  const v1 = {
    lanes: [
      [{ type: 'key', code: 'KeyA' }, { type: 'pad', index: 2 }],
      [{ type: 'key', code: 'KeyS' }], [{ type: 'key', code: 'KeyW' }], [{ type: 'key', code: 'KeyD' }]
    ],
    start: [{ type: 'key', code: 'Enter' }], back: [{ type: 'key', code: 'Escape' }]
  };
  const b = migrateV1(v1);
  assert.equal(laneFor(b.keyboard, 'KeyA'), 0);
  assert.equal(laneFor(b.keyboard, 'KeyD'), 3);
  assert.deepEqual(b.pads, {});
});

test('loadBindings migrates from a v1 store when no v2 is present', () => {
  const store = fakeStorage({
    'ddr.binds.v1': JSON.stringify({
      lanes: [[{ type: 'key', code: 'KeyQ' }], [{ type: 'key', code: 'ArrowDown' }], [{ type: 'key', code: 'ArrowUp' }], [{ type: 'key', code: 'ArrowRight' }]],
      start: [{ type: 'key', code: 'Enter' }], back: [{ type: 'key', code: 'Escape' }]
    })
  });
  const b = loadBindings(store);
  assert.equal(laneFor(b.keyboard, 'KeyQ'), 0);
});

test('a corrupt store falls back to defaults, not a crash', () => {
  const store = fakeStorage({ 'ddr.binds.v2': '{ not json' });
  const b = loadBindings(store);
  assert.equal(laneFor(b.keyboard, 'ArrowLeft'), 0);
});

test('describeSlot renders human labels', () => {
  assert.equal(describeSlot(defaultKeyboard(), 0, false), 'Left');
  assert.equal(describeSlot(defaultPad(), 0, true), 'Btn 14');
});

test('a second keyboard defaults to WASD for a two-on-one-keyboard game', () => {
  const b = defaultBindings();
  assert.ok(b.keyboard2);
  assert.equal(laneFor(b.keyboard2, 'KeyA'), 0); // left
  assert.equal(laneFor(b.keyboard2, 'KeyS'), 1); // down
  assert.equal(laneFor(b.keyboard2, 'KeyW'), 2); // up
  assert.equal(laneFor(b.keyboard2, 'KeyD'), 3); // right
});
