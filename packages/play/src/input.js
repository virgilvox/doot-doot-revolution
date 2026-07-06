// input: unified keyboard and Web Gamepad input, device-aware and rebindable. It reads
// its mappings from bindings.js (the keyboard and each gamepad type keep their own lane
// map), resolves a raw key or button to a lane for its device, and emits:
//   'down' / 'up'   { lane, device }
//   'start' / 'back' { device }
//   'bound'          { device, slot }   after a rebind
// device is 'keyboard' or 'pad:<deviceKey>'. Call attach(window) once to bind DOM
// listeners and poll() every frame to sample gamepads. Consumers read the song clock
// synchronously in the handler for accurate hit timing. Held state is tracked per device
// (heldFor) with a combined view (held) for single-player.
//
// Gamepad start/back come from the device's bound slots (a real dance pad or non-standard
// controller maps whatever buttons the user pressed during setup). As a convenience,
// a standard-mapped pad also treats the bottom face button (0) as start and the right
// face button (1) as back, so a plain Xbox/PlayStation controller drives menus with no
// setup. That convenience is gated on gp.mapping === 'standard': a non-standard pad, whose
// Down panel commonly enumerates as button 0 or 1, must never fire a spurious start/back.

import {
  LANE_NAMES, loadBindings, saveBindings, defaultBindings, padDeviceKey,
  laneFor, inSlot, setBinding, ensurePad, describeSlot
} from './bindings.js';

const KB = 'keyboard';
const KEYBOARDS = ['keyboard', 'keyboard2']; // player 1 (arrows) and player 2 (WASD)
const isPadDevice = (d) => d.slice(0, 4) === 'pad:';
const padDevice = (key) => 'pad:' + key;

function pickStorage(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) {}
  return null;
}

export function createInput(options = {}) {
  const store = pickStorage(options.storage);
  let binds = loadBindings(store, options.key);
  let padEnabled = true;
  let listening = null;              // { device, slot } while capturing a rebind
  const heldMap = {};                // device -> [bool x4]
  const prevActive = {};             // gp.index -> Set of raw inputs active last poll (edge detect)
  const axisRest = {};               // gp.index -> resting axis values, sampled on first sight
  const listeners = new Map();

  // A raw pad input is either a button index (number) or an axis token 'a<index><sign>'.
  // Many dance pads and PSX/DirectInput adapters deliver the four arrows as an analog
  // axis (a stick or a hat) instead of buttons, so the arrows never appear in gp.buttons.
  // We read gp.axes too and turn a deflection past AXIS_ON (measured from the resting
  // value, so a hat that rests at 1.0 does not stick) into a token the binding maps and
  // the remap wizard treat exactly like a button.
  const AXIS_ON = 0.5;

  function emit(ev, data) { const s = listeners.get(ev); if (s) s.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  function on(ev, fn) { let s = listeners.get(ev); if (!s) { s = new Set(); listeners.set(ev, s); } s.add(fn); return () => s.delete(fn); }
  function save() { saveBindings(store, binds, options.key); }

  function heldOf(device) { return heldMap[device] || (heldMap[device] = [false, false, false, false]); }
  function down(device, lane) { const h = heldOf(device); if (h[lane]) return; h[lane] = true; emit('down', { lane, device }); }
  function up(device, lane) { const h = heldOf(device); if (!h[lane]) return; h[lane] = false; emit('up', { lane, device }); }
  function combinedHeld() { const out = [false, false, false, false]; for (const d in heldMap) for (let l = 0; l < 4; l++) if (heldMap[d][l]) out[l] = true; return out; }
  // resolve a device string to its map: keyboard, keyboard2, or pad:<key>
  function mapFor(device) { return device === 'keyboard' ? binds.keyboard : device === 'keyboard2' ? binds.keyboard2 : ensurePad(binds, device.slice(4)); }
  function bindNow(device, slot, raw, map) { setBinding(map, slot, raw); save(); listening = null; emit('bound', { device, slot }); }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (listening && (listening.device === 'keyboard' || listening.device === 'keyboard2')) { bindNow(listening.device, listening.slot, e.code, mapFor(listening.device)); if (e.preventDefault) e.preventDefault(); return; }
    if (/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) return;
    // resolve against both keyboards; the first match owns the key (arrows -> p1, WASD -> p2)
    for (const dev of KEYBOARDS) {
      const m = mapFor(dev);
      // preventDefault on start/back too, not just lanes: otherwise Enter also fires the
      // browser default click on a DOM-focused button (a nav tab you clicked earlier), so a
      // confirm would exit a modal or navigate instead of confirming. The input/textarea
      // guard above keeps text fields (Enter to submit a URL) working.
      if (inSlot(m, 'start', e.code)) { emit('start', { device: dev }); if (e.preventDefault) e.preventDefault(); return; }
      if (inSlot(m, 'back', e.code)) { emit('back', { device: dev }); if (e.preventDefault) e.preventDefault(); return; }
      const l = laneFor(m, e.code); if (l >= 0) { down(dev, l); if (e.preventDefault) e.preventDefault(); return; }
    }
  }
  function onKeyUp(e) { for (const dev of KEYBOARDS) { const l = laneFor(mapFor(dev), e.code); if (l >= 0) { up(dev, l); return; } } }

  // gamepad source: injectable for tests, else the Web Gamepad API when present.
  function currentPads() {
    if (options.getGamepads) return options.getGamepads() || [];
    if (typeof navigator !== 'undefined' && navigator.getGamepads) return navigator.getGamepads();
    return [];
  }

  // the raw inputs held this frame: pressed button indices plus axis tokens for any
  // axis deflected past AXIS_ON from its resting value
  function rawInputs(gp) {
    const active = [];
    for (let b = 0; b < gp.buttons.length; b++) if (gp.buttons[b].pressed) active.push(b);
    const axes = gp.axes || [];
    const rest = axisRest[gp.index] || (axisRest[gp.index] = Array.from(axes, (v) => v || 0));
    for (let i = 0; i < axes.length; i++) {
      const d = axes[i] - (rest[i] || 0);
      if (d <= -AXIS_ON) active.push('a' + i + '-');
      else if (d >= AXIS_ON) active.push('a' + i + '+');
    }
    return active;
  }

  function resolveDown(device, map, standard, raw) {
    if (listening && listening.device === device) { bindNow(device, listening.slot, raw, map); return; }
    const l = laneFor(map, raw);
    if (l >= 0) { down(device, l); return; }
    if (inSlot(map, 'start', raw)) { emit('start', { device }); return; }
    if (inSlot(map, 'back', raw)) { emit('back', { device }); return; }
    // face-button convenience, standard mapping only (see the file header)
    if (standard && raw === 0) emit('start', { device });
    else if (standard && raw === 1) emit('back', { device });
  }

  function poll() {
    if (!padEnabled) return;
    for (const gp of currentPads()) {
      if (!gp) continue;
      const key = padDeviceKey(gp), device = padDevice(key), map = ensurePad(binds, key);
      const standard = gp.mapping === 'standard';
      const now = new Set(rawInputs(gp));
      const prev = prevActive[gp.index] || new Set();
      for (const raw of now) if (!prev.has(raw)) resolveDown(device, map, standard, raw);
      for (const raw of prev) if (!now.has(raw)) { const l = laneFor(map, raw); if (l >= 0) up(device, l); }
      prevActive[gp.index] = now;
    }
  }

  // connected gamepads with their stable device key (for the Pads screen and routing)
  function pads() {
    const out = [];
    for (const gp of currentPads()) if (gp) { const key = padDeviceKey(gp); out.push({ key, device: padDevice(key), id: gp.id, index: gp.index }); }
    return out;
  }

  // live raw state for the Pads-screen diagnostic: what the browser actually reports,
  // so a user can press each panel and see whether it reaches the browser at all (a
  // driver/adapter problem) or reaches it under some button/axis they can then remap.
  function rawPads() {
    const out = [];
    for (const gp of currentPads()) if (gp) {
      out.push({
        key: padDeviceKey(gp), id: gp.id, index: gp.index, mapping: gp.mapping || '',
        buttons: Array.from(gp.buttons || [], (b) => !!b.pressed),
        axes: Array.from(gp.axes || [], (v) => Math.round(v * 100) / 100)
      });
    }
    return out;
  }

  // every assignable input device (both keyboards plus any connected pads), for the Pads
  // screen and the multiplayer roster's device pickers
  function devices() {
    const out = [{ device: 'keyboard', label: 'Keyboard (arrows)', kind: 'keyboard' }, { device: 'keyboard2', label: 'Keyboard (WASD)', kind: 'keyboard' }];
    for (const p of pads()) out.push({ device: p.device, label: p.id, kind: 'controller' });
    return out;
  }

  let _kd = null, _ku = null, _target = null;
  function attach(target) {
    _target = target || (typeof window !== 'undefined' ? window : null); if (!_target) return;
    _kd = onKeyDown; _ku = onKeyUp; _target.addEventListener('keydown', _kd); _target.addEventListener('keyup', _ku);
  }
  function detach() { if (_target) { _target.removeEventListener('keydown', _kd); _target.removeEventListener('keyup', _ku); _target = null; } }

  return {
    LANE_NAMES, on, poll, attach, detach, pads, rawPads, devices,
    held: combinedHeld,
    heldFor: (device) => heldOf(device).slice(),
    isDown: (lane) => combinedHeld()[lane],
    bindings: () => binds,
    deviceMap: mapFor,
    listen: (device, slot) => { listening = { device, slot }; },
    cancelListen: () => { listening = null; },
    setPadEnabled: (v) => { padEnabled = !!v; },
    padEnabled: () => padEnabled,
    describe: (device, slot) => describeSlot(mapFor(device), slot, isPadDevice(device)),
    reset: () => { binds = defaultBindings(); save(); }
  };
}
