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

// A YouTube watch/short/embed/youtu.be link. Extraction is desktop-only (it needs
// the main process), so views only offer it when canImportUrl is true.
export function isYouTubeUrl(url) { return /(?:youtube\.com\/(?:watch\?|shorts\/|embed\/|live\/)|youtu\.be\/)/i.test(String(url || '')); }

let cached = null;
export function usePlatform() {
  if (cached) return cached;
  const doot = (typeof window !== 'undefined') ? window.doot : null;
  const isDesktop = !!(doot && doot.isDesktop);
  // Web import routing, baked at build time so a deploy can point at its own
  // infrastructure. CORS_PROXY lets the browser fetch a direct audio URL past the
  // CORS wall (a plain forwarder; it cannot rip YouTube). YT_ENDPOINT is a yt-dlp
  // backend the browser hands YouTube links to, since a browser cannot decipher
  // YouTube itself. Desktop ignores both and fetches/rips in the main process.
  const CORS_PROXY = (import.meta.env && import.meta.env.VITE_CORS_PROXY) || '';
  const YT_ENDPOINT = (import.meta.env && import.meta.env.VITE_YT_ENDPOINT) || '';
  // On web, YouTube import needs the desktop app; point users at a reputable
  // third-party downloader instead. cobalt.tools is open source and ad-free; override
  // with VITE_YT_HELP_URL. It is not affiliated with this app.
  const YT_HELP_URL = (import.meta.env && import.meta.env.VITE_YT_HELP_URL) || 'https://cobalt.tools';
  // The URL import row shows everywhere now; the fetch behavior adapts per platform.
  const canImportUrl = true;
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
      // web: route through the configured CORS proxy when set, else a plain fetch
      // (which only succeeds for CORS-permissive hosts)
      const res = await fetch(CORS_PROXY ? CORS_PROXY + url : url);
      if (!res.ok) throw new Error('HTTP ' + res.status); return res.arrayBuffer();
    },
    isYouTube: (url) => isYouTubeUrl(url),
    ytHelpUrl: YT_HELP_URL,
    // Rip audio from a YouTube URL. Desktop rips locally with yt-dlp. The browser
    // cannot (CORS + signature deciphering), so on web it hands the link to a
    // configured yt-dlp backend (VITE_YT_ENDPOINT, e.g. a DigitalOcean function)
    // that returns the audio bytes with the title in an X-Video-Title header; with
    // none set it explains the two ways to enable it.
    async fetchYouTube(url) {
      if (isDesktop) return doot.fetchYouTube(url); // { bytes, title, mime }
      if (!YT_ENDPOINT) throw new Error('YouTube import needs the desktop app, or set VITE_YT_ENDPOINT to your own yt-dlp backend');
      const res = await fetch(YT_ENDPOINT + (YT_ENDPOINT.includes('?') ? '&' : '?') + 'url=' + encodeURIComponent(url));
      if (!res.ok) throw new Error('backend HTTP ' + res.status);
      const bytes = await res.arrayBuffer();
      let title = res.headers.get('X-Video-Title') || 'YouTube';
      try { title = decodeURIComponent(title); } catch (err) { /* header was plain */ }
      return { bytes, title, mime: (res.headers.get('Content-Type') || 'audio/webm').split(';')[0].trim() };
    },
    // one-line hint for the import row. On web with no YouTube backend it covers only
    // the direct-URL case; the YouTube-needs-desktop note (with the downloader link) is
    // shown separately via showYtHelp so the message is not duplicated.
    urlImportHint: isDesktop
      ? 'Paste a direct audio URL or a YouTube link, fetched and ripped locally.'
      : (YT_ENDPOINT
        ? 'Paste a direct audio URL or a YouTube link.'
        : 'Paste a direct audio URL' + (CORS_PROXY ? '.' : ' (CORS-friendly hosts).')),
    // show the "use a downloader" note only when YouTube cannot work here (web, no backend)
    showYtHelp: !isDesktop && !YT_ENDPOINT,
    chooseFolder: () => library.chooseFolder(),
    exportFolder: () => library.exportToFolder(),
    importFolder: () => library.importFromFolder()
  };
  return cached;
}
