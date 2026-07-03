import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { makeDemos } from '../game/demos.js';
import { useLibraryStore } from './library.js';

// A special always-present wheel entry that launches the endless perpetual mode
// instead of a fixed song (handled by DifficultyModal / useSession.startEndless).
const ENDLESS_TILE = { id: 'endless', title: 'Perpetual', artist: 'Endless generative mix', genre: 'Generative', bpm: 130, endless: true, source: 'endless', duration: 0, charts: {} };

// The song wheel model: demo songs, the saved library, and the endless tile, with a
// selection index the wheel and hero read from.
export const useSongsStore = defineStore('songs', () => {
  const demos = ref([]);
  const sel = ref(0);
  const lib = useLibraryStore();
  const all = computed(() => [...demos.value, ...lib.songs, ENDLESS_TILE]);
  const current = computed(() => all.value[sel.value] || null);

  function ensureDemos() { if (!demos.value.length) demos.value = makeDemos(); lib.init(); }
  function move(delta) { const n = all.value.length; if (!n) return; sel.value = ((sel.value + delta) % n + n) % n; }
  function selectId(id) { const i = all.value.findIndex((s) => s.id === id); if (i >= 0) sel.value = i; }

  return { demos, sel, all, current, ensureDemos, move, selectId };
});
