// bindings: device-keyed input mappings. The keyboard and each gamepad type get their
// own lane map, so different controllers (Xbox, PlayStation, a dance pad) each keep a
// correct button->lane mapping, and multiplayer can route a device to a player. This is
// pure data plus resolution and persistence; the input runtime (input.js) drives it.
//
// Lanes are 0 LEFT, 1 DOWN, 2 UP, 3 RIGHT. A "device map" lists the raw inputs that fire
// each lane plus start/back: keyboard maps hold KeyboardEvent.code strings, pad maps hold
// gamepad button indices. The root shape is { keyboard: map, pads: { [deviceKey]: map } }.

export const LANE_NAMES = ['LEFT', 'DOWN', 'UP', 'RIGHT'];
const V2_KEY = 'ddr.binds.v2';
const V1_KEY = 'ddr.binds.v1';

export function defaultKeyboard() {
  return { lanes: [['ArrowLeft'], ['ArrowDown'], ['ArrowUp'], ['ArrowRight']], start: ['Enter'], back: ['Escape'] };
}
export function defaultPad() {
  // standard-gamepad d-pad: 12 up, 13 down, 14 left, 15 right; 9 start, 8 select/back
  return { lanes: [[14], [13], [12], [15]], start: [9], back: [8] };
}
export function defaultBindings() { return { keyboard: defaultKeyboard(), pads: {} }; }

// A stable key for a gamepad across reconnects and index changes: the USB vendor:product
// when the browser exposes it, else the id with volatile parentheticals stripped, so the
// same controller type always resolves to the same map.
export function padDeviceKey(gp) {
  const id = String((gp && gp.id) || 'gamepad');
  const vp = /vendor:\s*([0-9a-f]{4}).*?product:\s*([0-9a-f]{4})/i.exec(id);
  if (vp) return vp[1].toLowerCase() + ':' + vp[2].toLowerCase();
  const norm = id.replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return norm.slice(0, 40) || 'gamepad';
}

// -1 when the input maps to no lane in this device map.
export function laneFor(map, input) { for (let l = 0; l < 4; l++) if (map.lanes[l].indexOf(input) !== -1) return l; return -1; }
export function inSlot(map, slot, input) { return (map[slot] || []).indexOf(input) !== -1; }

// slot is a lane index 0..3, or 'start' / 'back'. One binding per slot per device, so
// binding is a plain replace.
export function setBinding(map, slot, input) {
  const arr = (slot === 'start' || slot === 'back') ? (map[slot] || (map[slot] = [])) : map.lanes[slot];
  arr.length = 0; arr.push(input);
  return map;
}

// Get (creating on first sight) the map for a connected pad, keyed by its device key.
export function ensurePad(bindings, deviceKey) {
  if (!bindings.pads[deviceKey]) bindings.pads[deviceKey] = defaultPad();
  return bindings.pads[deviceKey];
}

function keyLabel(code) { return String(code).replace('Arrow', '').replace('Key', '').replace('Digit', ''); }
export function describeSlot(map, slot, isPad) {
  const arr = (slot === 'start' || slot === 'back') ? (map[slot] || []) : map.lanes[slot];
  if (!arr || !arr.length) return 'unbound';
  return arr.map((x) => (isPad ? 'Btn ' + x : keyLabel(x))).join(' + ');
}

// Fill any missing structure so a hand-edited or partial store cannot crash resolution.
function fillMap(m, def) {
  const lanes = [0, 1, 2, 3].map((l) => (Array.isArray(m.lanes && m.lanes[l]) ? m.lanes[l].slice() : def.lanes[l].slice()));
  return { lanes, start: Array.isArray(m.start) ? m.start.slice() : def.start.slice(), back: Array.isArray(m.back) ? m.back.slice() : def.back.slice() };
}
function normalize(b) {
  const out = defaultBindings();
  if (b && b.keyboard && Array.isArray(b.keyboard.lanes)) out.keyboard = fillMap(b.keyboard, defaultKeyboard());
  if (b && b.pads && typeof b.pads === 'object') for (const k of Object.keys(b.pads)) out.pads[k] = fillMap(b.pads[k], defaultPad());
  return out;
}

// v1 stored one combined key+pad list per lane with no device identity. Keep the keyboard
// keys; drop the pad binds (the user re-maps each controller, now correctly per device).
export function migrateV1(v1) {
  const kb = defaultKeyboard();
  if (v1 && Array.isArray(v1.lanes)) {
    for (let l = 0; l < 4; l++) { const keys = (v1.lanes[l] || []).filter((x) => x && x.type === 'key').map((x) => x.code); if (keys.length) kb.lanes[l] = keys; }
    const st = (v1.start || []).filter((x) => x && x.type === 'key').map((x) => x.code); if (st.length) kb.start = st;
    const bk = (v1.back || []).filter((x) => x && x.type === 'key').map((x) => x.code); if (bk.length) kb.back = bk;
  }
  return { keyboard: kb, pads: {} };
}

export function loadBindings(store, key = V2_KEY) {
  try {
    const raw = store && store.getItem(key);
    if (raw) return normalize(JSON.parse(raw));
    const old = store && store.getItem(V1_KEY);
    if (old) return migrateV1(JSON.parse(old));
  } catch (e) { /* fall through to defaults */ }
  return defaultBindings();
}
export function saveBindings(store, bindings, key = V2_KEY) { try { if (store) store.setItem(key, JSON.stringify(bindings)); } catch (e) { /* ignore */ } }
