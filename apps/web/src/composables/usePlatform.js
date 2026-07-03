// usePlatform: one source of truth for the capabilities that differ between the
// deployed web app and the Electron desktop app. The important design point is
// that the storage model is the SAME everywhere: songs you add live in
// IndexedDB, and the synthesized demo songs are generated client side, so the app
// is fully self contained on a plain static web host. Only two things vary by
// environment, and both feature detect:
//   - folder sync, available where the File System Access API is (Chromium and
//     the desktop app), otherwise a portable .ddr backup covers everyone.
//   - URL audio import, which needs the main process to fetch past the CORS wall,
//     so it is a desktop-only feature.
// Views read this and adapt their copy and controls; nothing branches on the
// environment ad hoc.

import { songToSM } from '@doot-games/chart';
import { library } from '../game/singletons.js';

function download(name, blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

const safeName = (s) => (s || 'song').replace(/[^\w.-]+/g, '_');

let cached = null;
export function usePlatform() {
  if (cached) return cached;
  const doot = (typeof window !== 'undefined') ? window.doot : null;
  const isDesktop = !!(doot && doot.isDesktop);
  const canImportUrl = isDesktop;
  // On desktop the library IS a folder of files, so the File System Access sync
  // (a web-only convenience) is hidden to avoid two competing folder concepts.
  const canFolderSync = !isDesktop && library.canFolder;

  const where = isDesktop
    ? 'Songs you add are saved as .ddr files in the library folder you choose.'
    : 'Songs you add live in this browser (IndexedDB).';
  const move = isDesktop
    ? 'They are ordinary files, so move or back them up like any other, or export a single .ddr library snapshot.'
    : (canFolderSync ? 'Sync them to a folder on disk, or download a .ddr backup to move them between machines.' : 'Download a .ddr backup to keep them or move them between machines.');

  cached = {
    isDesktop, canFolderSync, canImportUrl,
    fsLibrary: isDesktop,
    storageDescription: where + ' ' + move,
    libraryDir: () => (isDesktop ? doot.lib.dir() : Promise.resolve(null)),
    chooseLibraryDir: () => (isDesktop ? doot.lib.choose() : Promise.resolve(null)),
    revealLibrary: () => (isDesktop ? doot.lib.reveal() : Promise.resolve()),
    backup: async () => download('doot-library.ddr', await library.exportFile()),
    restore: (file) => library.importFile(file),
    // download a song's charts as a StepMania .sm file (all difficulties in one)
    exportSM: (record) => download(safeName(record.title) + '.sm', new Blob([songToSM(record)], { type: 'text/plain' })),
    // fetch remote audio bytes. Desktop routes through the main process and
    // bypasses the browser CORS wall; on web it is a normal fetch (CORS applies).
    async fetchAudio(url) {
      if (isDesktop) return doot.fetchAudio(url);
      const res = await fetch(url); if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer();
    },
    chooseFolder: () => library.chooseFolder(),
    exportFolder: () => library.exportToFolder(),
    importFolder: () => library.importFromFolder()
  };
  return cached;
}
