// core: the pub/sub bus and persisted settings. No DOM, no audio.
// These are the seams the rest of the workspace talks through, so they carry
// no game logic of their own.

// A tiny synchronous event bus. Handlers that throw are isolated so one bad
// subscriber cannot break an emit.
export function createBus() {
  const map = new Map();
  return {
    on(ev, fn) {
      let set = map.get(ev);
      if (!set) { set = new Set(); map.set(ev, set); }
      set.add(fn);
      return () => set.delete(fn);
    },
    once(ev, fn) {
      const off = this.on(ev, (data) => { off(); fn(data); });
      return off;
    },
    emit(ev, data) {
      const set = map.get(ev);
      if (!set) return;
      set.forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });
    }
  };
}

function pickStorage(storage) {
  if (storage) return storage;
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) {}
  return null;
}

// Persisted settings over a key/value store (localStorage by default). Emits
// 'change' on the returned bus-like object when a value is set or reset, so the
// audio engine and screens can react without polling.
export function createSettings({ key = 'ddr.settings.v1', defaults = {}, storage } = {}) {
  const store = pickStorage(storage);
  const listeners = new Set();
  let state = Object.assign({}, defaults);
  try {
    const raw = store && store.getItem(key);
    if (raw) state = Object.assign(state, JSON.parse(raw));
  } catch (e) {}

  function save() {
    try { if (store) store.setItem(key, JSON.stringify(state)); } catch (e) {}
  }
  function fire(change) { listeners.forEach((fn) => { try { fn(change); } catch (e) { console.error(e); } }); }

  return {
    all() { return Object.assign({}, state); },
    get(k) { return state[k]; },
    set(k, v) { state[k] = v; save(); fire({ key: k, value: v, all: state }); },
    reset() { state = Object.assign({}, defaults); save(); fire({ all: state }); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  };
}
