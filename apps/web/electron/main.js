// Electron main process. Keeps the secure defaults on, serves the built SPA from
// a registered app:// scheme in production (so IndexedDB and cross-origin
// isolation work, unlike file://), and exposes two desktop-only capabilities over
// IPC: a CORS-free audio fetch, and a song library that lives as real .ddr files
// in a folder the user picks (contained to that folder, no arbitrary path access).

import { app, BrowserWindow, session, protocol, ipcMain, net, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;

// This bundles to an ES module (the app package.json has "type": "module"), where
// __dirname does not exist; derive it from import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const RENDERER = path.join(__dirname, '../dist');
const ISOLATION = { 'Cross-Origin-Opener-Policy': ['same-origin'], 'Cross-Origin-Embedder-Policy': ['require-corp'] };

// must run before app is ready
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.wasm': 'application/wasm', '.map': 'application/json' };
function mime(f) { return MIME[path.extname(f)] || 'application/octet-stream'; }

async function serveApp() {
  protocol.handle('app', async (req) => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const full = path.join(RENDERER, p);
    // contain to the renderer dir: decode happens after URL normalization, so a
    // percent-encoded ../ could otherwise escape RENDERER. Fall back to index.
    const contained = full === RENDERER || full.startsWith(RENDERER + path.sep);
    try {
      if (!contained) throw new Error('out of bounds');
      const data = await fs.readFile(full);
      return new Response(data, { headers: { 'Content-Type': mime(p), ...toResHeaders(ISOLATION) } });
    } catch (e) {
      const data = await fs.readFile(path.join(RENDERER, 'index.html'));
      return new Response(data, { headers: { 'Content-Type': 'text/html', ...toResHeaders(ISOLATION) } });
    }
  });
}
function toResHeaders(h) { const o = {}; for (const k in h) o[k] = h[k][0]; return o; }

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: '#EEF1FF',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  // open external https links (such as the GitHub link) in the system browser, and
  // deny any attempt to open a window inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, u) => {
    const ok = (isDev && u.startsWith(process.env.VITE_DEV_SERVER_URL)) || u.startsWith('app://');
    if (!ok) e.preventDefault();
  });
  if (isDev) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadURL('app://local/index.html');
  setupUpdater(win);
}

// Desktop auto-update. In the packaged app, check GitHub releases on launch (and every
// few hours), download a newer build in the background, and tell the renderer when one is
// available and when it is downloaded. The user chooses when to restart to apply it;
// nothing installs behind their back mid-session. Settings and the song library live in
// userData, which the update never touches, so they carry over.
function setupUpdater(win) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  const send = (data) => { try { if (win && !win.isDestroyed()) win.webContents.send('update:status', data); } catch (e) {} };
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info && info.version }));
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info && info.version }));
  autoUpdater.on('error', (err) => send({ state: 'error', message: String((err && err.message) || err) }));
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}

// The library location is remembered in a small config file in userData. The song
// files themselves live wherever the user chose.
function configPath() { return path.join(app.getPath('userData'), 'config.json'); }
async function readConfig() { try { return JSON.parse(await fs.readFile(configPath(), 'utf8')); } catch (e) { return {}; } }
async function writeConfig(c) { await fs.writeFile(configPath(), JSON.stringify(c)); }
async function libraryDir() { return (await readConfig()).libraryDir || null; }

// Resolve a song file inside the library dir and refuse anything that escapes it.
// Ids are app-generated, but validate defensively: reject any id that is not a
// plain filename (a separator or a .. would make basename differ), then confirm
// the resolved path stays under the library dir.
function songFile(dir, id) {
  const name = String(id);
  if (!name || path.basename(name) !== name) throw new Error('bad id');
  const base = path.resolve(dir), full = path.join(base, name + '.ddr');
  if (!full.startsWith(base + path.sep)) throw new Error('bad path');
  return full;
}

// Identify the audio container from its leading bytes so the stored blob carries an
// honest type (the renderer decodes by content regardless, but a correct mime keeps
// the .ddr export truthful). Covers the formats YouTube bestaudio yields, plus mp3.
function sniffAudioMime(b) {
  if (b.length > 4 && b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'audio/webm';
  if (b.length > 8 && b.toString('ascii', 4, 8) === 'ftyp') return 'audio/mp4';
  if (b.length > 3 && (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0))) return 'audio/mpeg';
  return 'audio/webm';
}

// youtube-dl-exec runs a bundled yt-dlp binary. Packaged on macOS/Linux it lives
// inside app.asar.unpacked, whose absolute path contains spaces (the ".app" bundle
// name), and youtube-dl-exec splits the spawn command on spaces there, so it never
// finds it. The binary is signed and notarized *in place*, so copying it out of the
// bundle loses that trust and the hardened runtime / Gatekeeper kills the copy
// (ChildProcessError). Instead point a space-free symlink at it and run that: the OS
// executes the real, trusted binary. The bundled build is self-contained (its own
// Python plus built-in signature deciphering), so it needs no system Python or
// external JS runtime. Windows quotes the path (spaces are fine) and dev paths have no
// spaces, so both use the default resolution.
let _ytdlp = null;
async function getYtdlp() {
  if (_ytdlp) return _ytdlp;
  const mod = await import('youtube-dl-exec');
  if (!app.isPackaged || process.platform === 'win32') { _ytdlp = mod.default; return _ytdlp; }
  const src = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'youtube-dl-exec', 'bin', 'yt-dlp');
  const link = path.join(app.getPath('temp'), 'doot-ytdlp', 'yt-dlp');
  await fs.mkdir(path.dirname(link), { recursive: true });
  try { await fs.unlink(link); } catch (e) { /* no stale link to clear */ }
  await fs.symlink(src, link);
  _ytdlp = mod.create(link);
  return _ytdlp;
}

function registerIpc() {
  // Auto-update controls: install the downloaded update (quit + replace + relaunch), or
  // re-check on demand. Safe no-ops in dev / when not packaged.
  ipcMain.handle('update:install', () => { try { autoUpdater.quitAndInstall(); } catch (e) {} });
  ipcMain.handle('update:check', async () => {
    const current = app.getVersion();
    if (!app.isPackaged) return { current, latest: current, updateAvailable: false };
    try {
      const r = await autoUpdater.checkForUpdates();
      const latest = (r && r.updateInfo && r.updateInfo.version) || current;
      return { current, latest, updateAvailable: latest !== current };
    } catch (e) { return { current, latest: null, updateAvailable: false, error: true }; }
  });
  // Fetch remote audio bytes past the browser CORS wall.
  ipcMain.handle('audio:fetch', async (e, url) => {
    let proto; try { proto = new URL(url).protocol; } catch (err) { throw new Error('bad url'); }
    if (proto !== 'http:' && proto !== 'https:') throw new Error('only http(s) URLs are allowed');
    const r = await net.fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.arrayBuffer();
  });

  // Rip audio from a YouTube URL with yt-dlp (via youtube-dl-exec, loaded lazily).
  // yt-dlp reliably deciphers YouTube's signature where the pure-JS extractors
  // currently do not. The bundled build is self-contained (its own Python plus a
  // built-in interpreter for signature deciphering), so it needs no system Python or
  // external JS runtime. First a metadata pass for the title and a length cap, then the best
  // audio-only stream to a temp file, returned as bytes (webm/opus or m4a, both
  // decodable by the renderer's Web Audio) plus the title. This downloads content
  // subject to YouTube's terms and to copyright; it is meant for material the user
  // is entitled to use. --no-playlist keeps a radio/list link to its single video.
  ipcMain.handle('audio:youtube', async (e, url) => {
    let host; try { host = new URL(url).hostname.replace(/^(www|m|music)\./, ''); } catch (err) { throw new Error('bad url'); }
    if (host !== 'youtube.com' && host !== 'youtu.be') throw new Error('not a YouTube URL');
    const ytdlp = await getYtdlp();
    const base = { noPlaylist: true, noWarnings: true };
    // surface yt-dlp's real failure (its stderr tail) rather than a bare ChildProcessError
    const run = async (opts) => {
      try { return await ytdlp(url, opts); }
      catch (err) { const tail = String((err && err.stderr) || '').trim().split('\n').filter(Boolean).pop(); throw new Error(tail || (err && err.shortMessage) || (err && err.message) || 'yt-dlp failed'); }
    };
    const info = await run({ ...base, dumpSingleJson: true, format: 'bestaudio' });
    if ((Number(info.duration) || 0) > 12 * 60) throw new Error('video is over 12 minutes');
    const out = path.join(app.getPath('temp'), `doot-yt-${Date.now()}.audio`);
    try {
      await run({ ...base, format: 'bestaudio', output: out });
      const b = await fs.readFile(out);
      return { bytes: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), title: info.title || 'YouTube', mime: sniffAudioMime(b) };
    } finally { fs.unlink(out).catch(() => {}); }
  });

  // The song library as files on disk. The renderer serializes each record to a
  // .ddr JSON string (audio included), so the main process only moves strings
  // keyed by id and never touches audio decoding.
  ipcMain.handle('lib:dir', () => libraryDir());
  ipcMain.handle('lib:choose', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Choose a folder for your song library', properties: ['openDirectory', 'createDirectory'] });
    if (canceled || !filePaths[0]) return await libraryDir();
    const c = await readConfig(); c.libraryDir = filePaths[0]; await writeConfig(c);
    return filePaths[0];
  });
  ipcMain.handle('lib:list', async () => {
    const dir = await libraryDir(); if (!dir) return [];
    let names; try { names = await fs.readdir(dir); } catch (e) { return []; }
    const out = [];
    for (const n of names) { if (!n.endsWith('.ddr')) continue; try { out.push(await fs.readFile(path.join(dir, n), 'utf8')); } catch (e) { /* skip unreadable */ } }
    return out;
  });
  ipcMain.handle('lib:read', async (e, id) => {
    const dir = await libraryDir(); if (!dir) return null;
    try { return await fs.readFile(songFile(dir, id), 'utf8'); } catch (e) { return null; }
  });
  ipcMain.handle('lib:put', async (e, id, json) => {
    const dir = await libraryDir(); if (!dir) throw new Error('no library folder');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(songFile(dir, id), json);
  });
  ipcMain.handle('lib:remove', async (e, id) => {
    const dir = await libraryDir(); if (!dir) return;
    try { await fs.unlink(songFile(dir, id)); } catch (e) { /* already gone */ }
  });
  ipcMain.handle('lib:reveal', async () => { const dir = await libraryDir(); if (dir) shell.openPath(dir); });
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((d, cb) => cb({ responseHeaders: { ...d.responseHeaders, ...ISOLATION } }));
  if (!isDev) await serveApp();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
