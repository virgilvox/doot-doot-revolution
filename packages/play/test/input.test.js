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

// a fake gamepad whose button and axis states are mutable between polls
function fakePad({ index = 0, id = 'Test Pad (Vendor: 0001 Product: 0002)', mapping = 'standard', n = 16, axes = [] } = {}) {
  const buttons = Array.from({ length: n }, () => ({ pressed: false }));
  const ax = axes.slice();
  return {
    gp: { index, id, mapping, buttons, axes: ax },
    press: (b) => { buttons[b].pressed = true; },
    release: (b) => { buttons[b].pressed = false; },
    axis: (i, v) => { ax[i] = v; }
  };
}

test('default d-pad button drives its lane regardless of mapping', () => {
  const pad = fakePad({ mapping: '' });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  const downs = []; input.on('down', (e) => downs.push(e));
  pad.press(13); input.poll();               // d-pad down -> lane 1
  assert.deepEqual(downs[0], { lane: 1, device: 'pad:0001:0002' });
});

test('standard pad: face button 0 is start (confirm) and 1 is back (cancel)', () => {
  const pad = fakePad({ mapping: 'standard' });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  let started = 0, backed = 0;
  input.on('start', () => started++); input.on('back', () => backed++);
  pad.press(0); input.poll(); pad.release(0); input.poll();
  pad.press(1); input.poll(); pad.release(1); input.poll();
  assert.equal(started, 1);
  assert.equal(backed, 1);
});

test('non-standard pad never treats buttons 0/1 as start or back (the down-panel bug)', () => {
  // a dance pad reports mapping '' and can enumerate its Down panel as button 1
  const pad = fakePad({ mapping: '' });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  let started = 0, backed = 0;
  input.on('start', () => started++); input.on('back', () => backed++);
  pad.press(0); input.poll(); pad.release(0); input.poll();
  pad.press(1); input.poll(); pad.release(1); input.poll();
  assert.equal(started, 0);
  assert.equal(backed, 0);
});

test('a d-pad delivered as an analog axis can be bound to a lane and then drives it', () => {
  // a PSX/DirectInput adapter that puts the arrows on axes 0 (L/R) and 1 (U/D)
  const pad = fakePad({ mapping: '', axes: [0, 0] });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  const downs = [], ups = []; input.on('down', (e) => downs.push(e)); input.on('up', (e) => ups.push(e));
  let bound = null; input.on('bound', (e) => (bound = e));
  input.poll();                               // first sight at rest: baseline captured at 0
  input.listen('pad:0001:0002', 1);          // remap the DOWN lane
  pad.axis(1, 1); input.poll();               // step on Down: axis 1 to +1
  assert.deepEqual(bound, { device: 'pad:0001:0002', slot: 1 });
  assert.equal(input.describe('pad:0001:0002', 1), 'Axis 1 +');
  pad.axis(1, 0); input.poll();               // release
  pad.axis(1, 1); input.poll();               // now it drives lane 1
  assert.deepEqual(downs[0], { lane: 1, device: 'pad:0001:0002' });
  pad.axis(1, 0); input.poll();
  assert.deepEqual(ups[0], { lane: 1, device: 'pad:0001:0002' });
});

test('a hat axis that rests off-center does not phantom-fire its bound lane', () => {
  // some hats report a resting value of 1.0; sampled as the baseline, rest must be quiet
  const pad = fakePad({ mapping: '', axes: [1] });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  const downs = []; input.on('down', (e) => downs.push(e));
  input.poll();                               // first sight: baseline captured at 1.0
  input.listen('pad:0001:0002', 2);
  pad.axis(0, -1); input.poll();              // press Up: deflect to -1 (delta -2)
  assert.equal(input.describe('pad:0001:0002', 2), 'Axis 0 -');
  pad.axis(0, 1); input.poll();               // back to rest
  assert.deepEqual(downs, []);                // resting at 1.0 must not hold the lane
  pad.axis(0, 1); input.poll();
  assert.deepEqual(downs, []);
});

test('rawPads reports live buttons, axes, and mapping for the diagnostic', () => {
  const pad = fakePad({ mapping: '', axes: [0, 0.5] });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  pad.press(2);
  const [r] = input.rawPads();
  assert.equal(r.mapping, '');
  assert.equal(r.buttons[2], true);
  assert.equal(r.buttons[0], false);
  assert.deepEqual(r.axes, [0, 0.5]);
});

test('remapping a pad Select slot captures the next button and drives back', () => {
  const pad = fakePad({ mapping: '' });
  const input = createInput({ storage: fakeStorage(), getGamepads: () => [pad.gp] });
  let bound = null, backed = 0;
  input.on('bound', (e) => (bound = e)); input.on('back', () => backed++);
  input.listen('pad:0001:0002', 'back');
  pad.press(3); input.poll();                // capture button 3 into the back slot
  assert.deepEqual(bound, { device: 'pad:0001:0002', slot: 'back' });
  pad.release(3); input.poll();
  pad.press(3); input.poll();                // now button 3 fires back
  assert.equal(backed, 1);
});
