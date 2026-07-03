import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { makeDemos } from '../game/demos.js';
import { useLibraryStore } from './library.js';

// The song wheel model: demo songs plus the saved library, with a selection
// index the wheel and hero read from.
export const useSongsStore = defineStore('songs', () => {
  const demos = ref([]);
  const sel = ref(0);
  const lib = useLibraryStore();
  const all = computed(() => [...demos.value, ...lib.songs]);
  const current = computed(() => all.value[sel.value] || null);

  function ensureDemos() { if (!demos.value.length) demos.value = makeDemos(); lib.init(); }
  function move(delta) { const n = all.value.length; if (!n) return; sel.value = ((sel.value + delta) % n + n) % n; }
  function selectId(id) { const i = all.value.findIndex((s) => s.id === id); if (i >= 0) sel.value = i; }

  return { demos, sel, all, current, ensureDemos, move, selectId };
});
