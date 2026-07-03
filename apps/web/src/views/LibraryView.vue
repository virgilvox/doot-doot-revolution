<template>
  <div class="view"><div class="view-inner">
    <div class="scr-head"><button class="btn white sm" @click="back">&larr; Back</button><h1>Library</h1><span class="spacer"></span></div>
    <div class="panel" style="margin-bottom:14px">
      <div class="row">
        <div class="rl"><div class="t">Storage location</div><div class="d">{{ storeDesc }}</div></div>
        <div class="rc">
          <template v-if="plat.fsLibrary">
            <button class="btn white sm" :class="{ kfocus: fi === 0 }" @click="chooseLib">{{ libDir ? 'Change folder' : 'Choose folder…' }}</button>
            <button class="btn white sm" :class="{ kfocus: fi === 1 }" :disabled="!libDir" @click="plat.revealLibrary()">Reveal</button>
          </template>
          <template v-else>
            <button class="btn white sm" :class="{ kfocus: fi === 0 }" :disabled="!plat.canFolderSync" @click="chooseFolder">Choose folder…</button>
            <button class="btn white sm" :class="{ kfocus: fi === 1 }" :disabled="!folder" @click="exportFolder">Export</button>
            <button class="btn white sm" :class="{ kfocus: fi === 2 }" :disabled="!folder" @click="importFolder">Import</button>
          </template>
        </div>
      </div>
      <div class="row">
        <div class="rl"><div class="t">Backup</div><div class="d">Download or restore the whole library as a single .ddr file.</div></div>
        <div class="rc">
          <button class="btn white sm" :class="{ kfocus: fi === STORE }" @click="plat.backup()">Download .ddr</button>
          <button class="btn white sm" :class="{ kfocus: fi === STORE + 1 }" @click="$refs.file.click()">Restore…</button>
          <input ref="file" type="file" accept=".ddr,application/json" hidden @change="onRestore">
        </div>
      </div>
    </div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:12px">Songs · {{ lib.songs.length }}</div>
      <div v-if="!lib.songs.length" style="font-family:var(--fu);color:#7d7aa0;font-weight:600">No saved songs yet. Add one from the Add Song tab. The demo tracks are always on the Play screen.</div>
      <div v-else class="lib-list">
        <div v-for="(sng, i) in lib.songs" :key="sng.id" class="lib-item">
          <div class="cv" :style="{ background: covGrad(i + 1) }">{{ (sng.title || '?')[0].toUpperCase() }}</div>
          <div class="li"><div class="t">{{ sng.title }}</div><div class="d">{{ sng.artist }} · {{ Math.round(sng.bpm || 0) }} BPM · {{ Object.keys(sng.charts || {}).length }} charts · {{ sng.duration ? fmtTime(sng.duration) : '-' }}</div></div>
          <button class="btn sm" :class="{ kfocus: fi === TOP + i * PER }" @click="play(sng)">Play</button>
          <button class="btn white sm" :class="{ kfocus: fi === TOP + i * PER + 1 }" @click="exportSM(sng)">.sm</button>
          <button class="btn white sm" :class="{ kfocus: fi === TOP + i * PER + 2 }" @click="del(sng)">Delete</button>
        </div>
      </div>
    </div>
  </div></div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { go } from '../game/screen.js';
import { covGrad, fmtTime } from '../game/covers.js';
import { useLibraryStore } from '../stores/library.js';
import { useSongsStore } from '../stores/songs.js';
import { usePlatform } from '../composables/usePlatform.js';
import { useRovingFocus } from '../composables/useRovingFocus.js';
import { toast } from '../game/toast.js';

const lib = useLibraryStore();
const songs = useSongsStore();
const plat = usePlatform();
const file = ref(null);
const folder = ref(false);
const libDir = ref(null);
const storeDesc = ref(plat.storageDescription);

function back() { go('select'); }
function updateDesc() { storeDesc.value = plat.storageDescription + (libDir.value ? '  Folder: ' + libDir.value : ''); }

// desktop: the library lives in a folder on disk
async function chooseLib() { try { const d = await plat.chooseLibraryDir(); if (d) { libDir.value = d; updateDesc(); lib.refresh(); toast('Library folder set'); } } catch (e) { toast('Could not set folder'); } }
// web: optional File System Access folder sync
async function chooseFolder() { try { const nm = await plat.chooseFolder(); folder.value = true; storeDesc.value = 'Folder "' + nm + '" linked. Export writes songs there; Import reads them back.'; toast('Folder: ' + nm); } catch (e) { toast('Not supported here'); } }
async function exportFolder() { try { const n = await plat.exportFolder(); toast(n + ' written'); } catch (e) { toast('Export failed'); } }
async function importFolder() { try { const n = await plat.importFolder(); toast(n + ' imported'); lib.refresh(); } catch (e) { toast('Import failed'); } }
async function onRestore(e) { const f = e.target.files[0]; if (!f) return; try { const n = await plat.restore(f); toast('Restored ' + n + ' song' + (n === 1 ? '' : 's')); lib.refresh(); } catch (err) { toast('Not a valid .ddr file'); } e.target.value = ''; }
function play(sng) { songs.ensureDemos(); songs.selectId(sng.id); go('select'); }
async function del(sng) { await lib.remove(sng.id); toast('Deleted'); }
function exportSM(sng) { plat.exportSM(sng); toast('Exported ' + (sng.title || 'song') + '.sm'); }

onMounted(async () => {
  lib.init(); lib.refresh();
  if (plat.fsLibrary) { libDir.value = await plat.libraryDir(); updateDesc(); }
});

// Controller focus order: the storage buttons, then Download/Restore, then Play,
// .sm, and Delete per song. STORE is the storage-button count (it differs by
// platform), TOP is the whole top row, PER is the per-song action count. Building
// topActions from the same branch keeps the indices and the handlers in sync.
const STORE = plat.fsLibrary ? 2 : 3;
const topActions = plat.fsLibrary
  ? [chooseLib, () => plat.revealLibrary(), () => plat.backup(), () => file.value && file.value.click()]
  : [chooseFolder, exportFolder, importFolder, () => plat.backup(), () => file.value && file.value.click()];
const TOP = topActions.length, PER = 3;
const songActions = [play, exportSM, del];
function activate(i) {
  if (i < TOP) return topActions[i]();
  const j = i - TOP, sng = lib.songs[Math.floor(j / PER)];
  if (sng) return songActions[j % PER](sng);
}
const { index: fi } = useRovingFocus({ size: () => TOP + lib.songs.length * PER, onConfirm: activate, onCancel: back });
</script>
