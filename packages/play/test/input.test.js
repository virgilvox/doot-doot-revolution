import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from '@doot-games/play';

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; }
// a DOM-ish target that captures the keydown/keyup handlers so tests can fire events
function fakeTarget() { const h = {}; return { addEventListener: (t, fn) => { h[t] = fn; }, removeEventListener: () => {}, fire: (t, e) => h[t] && h[t](e) }; }

test('defaults bind the arrow keys to the four lanes on the keyboard device', () => {
  const input = createInput({ storage: fakeStorage() });
  assert.equal(input.bindings().keyboard.lanes.length, 4);
  assert.equal(input.describe('keyboard', 0), 'Left');
  assert.equal(input.describe('keyboard', 3), 'Right');
});

test('combined held starts clear and pad is enabled by default', () => {
  const input = createInput({ storage: fakeStorage() });
  assert.deepEqual(input.held(), [false, false, false, false]);
  assert.equal(input.isDown(0), false);
  assert.equal(input.padEnabled(), true);
  input.setPadEnabled(false);
  assert.equal(input.padEnabled(), false);
});

test('poll and pads are safe with no gamepad API present', () => {
  const input = createInput({ storage: fakeStorage() });
  assert.doesNotThrow(() => input.poll());
  assert.deepEqual(input.pads(), []);
});

test('keyboard key emits a device-tagged lane event and tracks held state', () => {
  const input = createInput({ storage: fakeStorage() });
  const target = fakeTarget();
  input.attach(target);
  const downs = []; input.on('down', (e) => downs.push(e));
  target.fire('keydown', { code: 'ArrowLeft', preventDefault() {} });
  assert.deepEqual(downs[0], { lane: 0, device: 'keyboard' });
  assert.equal(input.heldFor('keyboard')[0], true);
  assert.equal(input.held()[0], true);
  target.fire('keyup', { code: 'ArrowLeft' });
  assert.equal(input.heldFor('keyboard')[0], false);
  assert.equal(input.held()[0], false);
});

test('start and back fire from their keyboard slots', () => {
  const input = createInput({ storage: fakeStorage() });
  const target = fakeTarget(); input.attach(target);
  let started = 0, backed = 0;
  input.on('start', () => started++); input.on('back', () => backed++);
  target.fire('keydown', { code: 'Enter', preventDefault() {} });
  target.fire('keydown', { code: 'Escape', preventDefault() {} });
  assert.equal(started, 1);
  assert.equal(backed, 1);
});

test('listen captures the next key into a slot for its device', () => {
  const input = createInput({ storage: fakeStorage() });
  const target = fakeTarget(); input.attach(target);
  let bound = null; input.on('bound', (e) => (bound = e));
  input.listen('keyboard', 0);
  target.fire('keydown', { code: 'KeyH', preventDefault() {} });
  assert.deepEqual(bound, { device: 'keyboard', slot: 0 });
  assert.equal(input.describe('keyboard', 0), 'H');
  // the rebind now drives lane 0 and the old ArrowLeft no longer does
  const downs = []; input.on('down', (e) => downs.push(e));
  target.fire('keydown', { code: 'ArrowLeft', preventDefault() {} });
  assert.equal(downs.length, 0);
  target.fire('keydown', { code: 'KeyH', preventDefault() {} });
  assert.deepEqual(downs[0], { lane: 0, device: 'keyboard' });
});

test('reset restores keyboard defaults', () => {
  const input = createInput({ storage: fakeStorage() });
  input.reset();
  assert.equal(input.describe('keyboard', 0), 'Left');
});

test('WASD drives the second keyboard, arrows the first', () => {
  const input = createInput({ storage: fakeStorage() });
  const target = fakeTarget(); input.attach(target);
  const downs = []; input.on('down', (e) => downs.push(e));
  target.fire('keydown', { code: 'KeyA', preventDefault() {} });
  assert.deepEqual(downs[0], { lane: 0, device: 'keyboard2' });
  target.fire('keydown', { code: 'ArrowUp', preventDefault() {} });
  assert.deepEqual(downs[1], { lane: 2, device: 'keyboard' });
  assert.equal(input.heldFor('keyboard2')[0], true);
  assert.equal(input.heldFor('keyboard')[2], true);
});

test('devices lists both keyboards', () => {
  const input = createInput({ storage: fakeStorage() });
  const devs = input.devices().map((d) => d.device);
  assert.ok(devs.includes('keyboard'));
  assert.ok(devs.includes('keyboard2'));
});
