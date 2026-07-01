// input: unified keyboard and Web Gamepad input, rebindable per lane. Emits
// 'down' { lane }, 'up' { lane }, 'start', 'back', and 'bound' { lane }. Lanes
// are 0 Left, 1 Down, 2 Up, 3 Right. Consumers read the song clock synchronously
// in the handler for accurate hit timing.
//
// A slot can hold one key and one gamepad button. Bindings persist to a store
// (localStorage by default). Call attach(window) once to bind DOM listeners and
// poll() every frame to sample gamepads.

export const LANE_NAMES = ['LEFT', 'DOWN', 'UP', 'RIGHT'];

const DEFAULTS = () => ({
  lanes: [
    [{ type: 'key', code: 'ArrowLeft' }],
    [{ type: 'key', code: 'ArrowDown' }],
    [{ type: 'key', code: 'ArrowUp' }],
    [{ type: 'key', code: 'ArrowRight' }]
  ],
  start: [{ type: 'key', code: 'Enter' }],
  back: [{ type: 'key', code: 'Escape' }]
});

function pickStorage(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) {}
  return null;
}
function keyLabel(code) { return code.replace('Arrow', '').replace('Key', '').replace('Digit', ''); }

export function createInput(options = {}) {
  const store = pickStorage(options.storage), KEY = options.key || 'ddr.binds.v1';
  let binds;
  try { binds = (store && JSON.parse(store.getItem(KEY))) || DEFAULTS(); } catch (e) { binds = DEFAULTS(); }
  let padEnabled = true, listening = null;
  const laneDown = [false, false, false, false], prevPad = {}, listeners = new Map();

  function emit(ev, data) { const s = listeners.get(ev); if (s) s.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); }
  function on(ev, fn) { let s = listeners.get(ev); if (!s) { s = new Set(); listeners.set(ev, s); } s.add(fn); return () => s.delete(fn); }
  function save() { try { if (store) store.setItem(KEY, JSON.stringify(binds)); } catch (e) {} }

  function laneForKey(code) { for (let l = 0; l < 4; l++) if (binds.lanes[l].some((b) => b.type === 'key' && b.code === code)) return l; return -1; }
  function laneForPad(index) { for (let l = 0; l < 4; l++) if (binds.lanes[l].some((b) => b.type === 'pad' && b.index === index)) return l; return -1; }
  function upsert(lane, b) { const arr = binds.lanes[lane], i = arr.findIndex((x) => x.type === b.type); if (i >= 0) arr[i] = b; else arr.push(b); save(); }
  function down(lane) { if (laneDown[lane]) return; laneDown[lane] = true; emit('down', { lane }); }
  function up(lane) { if (!laneDown[lane]) return; laneDown[lane] = false; emit('up', { lane }); }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (listening != null) { upsert(listening, { type: 'key', code: e.code }); const done = listening; listening = null; emit('bound', { lane: done }); e.preventDefault(); return; }
    if (/^(input|textarea|select)$/i.test((e.target && e.target.tagName) || '')) return;
    if (binds.start.some((b) => b.type === 'key' && b.code === e.code)) emit('start');
    if (binds.back.some((b) => b.type === 'key' && b.code === e.code)) emit('back');
    const l = laneForKey(e.code); if (l >= 0) { down(l); e.preventDefault(); }
  }
  function onKeyUp(e) { const l = laneForKey(e.code); if (l >= 0) up(l); }

  function poll() {
    if (!padEnabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (const gp of pads) {
      if (!gp) continue;
      for (let b = 0; b < gp.buttons.length; b++) {
        const key = gp.index + ':' + b, pressed = gp.buttons[b].pressed, was = prevPad[key] || false;
        if (pressed && !was) {
          if (listening != null) { upsert(listening, { type: 'pad', index: b }); const done = listening; listening = null; emit('bound', { lane: done }); }
          else { const l = laneForPad(b); if (l >= 0) down(l); }
        } else if (!pressed && was) { const l = laneForPad(b); if (l >= 0) up(l); }
        prevPad[key] = pressed;
      }
    }
  }
  function connectedPad() { if (typeof navigator === 'undefined' || !navigator.getGamepads) return null; for (const gp of navigator.getGamepads()) { if (gp) return gp; } return null; }

  let _kd = null, _ku = null, _target = null;
  function attach(target) {
    _target = target || (typeof window !== 'undefined' ? window : null); if (!_target) return;
    _kd = onKeyDown; _ku = onKeyUp; _target.addEventListener('keydown', _kd); _target.addEventListener('keyup', _ku);
  }
  function detach() { if (_target) { _target.removeEventListener('keydown', _kd); _target.removeEventListener('keyup', _ku); _target = null; } }

  return {
    LANE_NAMES, on, poll, attach, detach, connectedPad,
    laneDown: () => laneDown.slice(),
    isDown: (lane) => laneDown[lane],
    bindings: () => binds,
    listen: (lane) => { listening = lane; },
    cancelListen: () => { listening = null; },
    setPadEnabled: (v) => { padEnabled = !!v; },
    padEnabled: () => padEnabled,
    describe: (lane) => binds.lanes[lane].map((b) => b.type === 'key' ? keyLabel(b.code) : ('Pad ' + b.index)).join('  +  ') || '—',
    reset: () => { binds = DEFAULTS(); save(); }
  };
}
