import { reactive, watch } from 'vue';
import { engine } from './singletons.js';

// The player's settings as one reactive object: the single source of truth. Vue's
// reactivity works outside components, so the 60fps render loop reads settings.speed
// directly (a plain property read, no per-frame tracking) and the Settings screen
// binds to the same object. Persistence and the side effects (audio volumes, the
// reduced-motion body class) are watchers, so there is no separate store to keep in
// sync.

const KEY = 'ddr.settings.v1';
const DEFAULTS = { speed: 2.4, offsetMs: 0, volMaster: 0.9, volMusic: 0.85, volSfx: 0.7, reducedMotion: false, background: true };

function load() {
  try { const raw = localStorage.getItem(KEY); return raw ? Object.assign({}, DEFAULTS, JSON.parse(raw)) : Object.assign({}, DEFAULTS); }
  catch (e) { return Object.assign({}, DEFAULTS); }
}

export const settings = reactive(load());
export function resetSettings() { Object.assign(settings, DEFAULTS); }

watch(settings, (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }, { deep: true });
watch(() => [settings.volMaster, settings.volMusic, settings.volSfx], () => engine.setVolumes({ master: settings.volMaster, music: settings.volMusic, sfx: settings.volSfx }), { immediate: true });
watch(() => settings.reducedMotion, (v) => { if (typeof document !== 'undefined') document.body.classList.toggle('reduce', v); }, { immediate: true });
