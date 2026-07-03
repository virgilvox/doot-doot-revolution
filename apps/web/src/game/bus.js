// A tiny synchronous event bus for the few cross-cutting game events: lane:down at
// input frame rate, game:end, and the navigation move/confirm/cancel. Vue 3 dropped
// its built-in emitter, and Pinia reactivity is the wrong tool for per-frame input,
// so this stays a deliberately minimal emitter. Handlers that throw are isolated so
// one bad subscriber cannot break an emit.
function createBus() {
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

export const bus = createBus();
