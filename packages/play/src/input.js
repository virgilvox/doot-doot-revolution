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
  const prevPad = {};                // 'gpIndex:button' -> pressed (rising-edge detect)
  const listeners = new Map();

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
      if (inSlot(m, 'start', e.code)) emit('start', { device: dev });
      if (inSlot(m, 'back', e.code)) emit('back', { device: dev });
      const l = laneFor(m, e.code); if (l >= 0) { down(dev, l); if (e.preventDefault) e.preventDefault(); return; }
    }
  }
  function onKeyUp(e) { for (const dev of KEYBOARDS) { const l = laneFor(mapFor(dev), e.code); if (l >= 0) { up(dev, l); return; } } }

  function poll() {
    if (!padEnabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      const key = padDeviceKey(gp), device = padDevice(key), map = ensurePad(binds, key);
      for (let b = 0; b < gp.buttons.length; b++) {
        const pk = gp.index + ':' + b, pressed = gp.buttons[b].pressed, was = prevPad[pk] || false;
        if (pressed && !was) {
          if (listening && listening.device === device) { bindNow(device, listening.slot, b, map); }
          else {
            if (inSlot(map, 'start', b)) emit('start', { device });
            if (inSlot(map, 'back', b)) emit('back', { device });
            const l = laneFor(map, b); if (l >= 0) down(device, l);
          }
        } else if (!pressed && was) { const l = laneFor(map, b); if (l >= 0) up(device, l); }
        prevPad[pk] = pressed;
      }
    }
  }

  // connected gamepads with their stable device key (for the Pads screen and routing)
  function pads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    const out = [];
    for (const gp of navigator.getGamepads()) if (gp) { const key = padDeviceKey(gp); out.push({ key, device: padDevice(key), id: gp.id, index: gp.index }); }
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
    LANE_NAMES, on, poll, attach, detach, pads, devices,
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
