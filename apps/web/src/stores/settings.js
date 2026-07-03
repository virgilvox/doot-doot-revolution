import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { settings, engine } from '../game/singletons.js';

// Reactive mirror of the persisted settings singleton. Writing here persists and
// applies side effects (volumes, reduced motion) in one place.
export const useSettingsStore = defineStore('settings', () => {
  const state = reactive(settings.all());
  function applyVolumes() { engine.setVolumes({ master: state.volMaster, music: state.volMusic, sfx: state.volSfx }); }
  function set(key, value) {
    settings.set(key, value); state[key] = value;
    if (key.startsWith('vol')) applyVolumes();
    if (key === 'reducedMotion') document.body.classList.toggle('reduce', value);
  }
  function reset() { settings.reset(); Object.assign(state, settings.all()); applyVolumes(); document.body.classList.toggle('reduce', state.reducedMotion); }
  document.body.classList.toggle('reduce', state.reducedMotion);
  return { state, set, reset };
});
