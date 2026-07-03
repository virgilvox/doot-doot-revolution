import { defineStore } from 'pinia';
import { ref } from 'vue';
import { library } from '../game/singletons.js';

// Reactive list over the IndexedDB library store. Refreshes on any write.
export const useLibraryStore = defineStore('library', () => {
  const songs = ref([]);
  let wired = false;
  async function refresh() { try { songs.value = (await library.list()) || []; } catch (e) { songs.value = []; } }
  function init() { if (wired) return; wired = true; library.onChange(refresh); refresh(); }
  const put = (rec) => library.put(rec);
  const remove = (id) => library.remove(id);
  const get = (id) => library.get(id);
  return { songs, refresh, init, put, remove, get };
});
