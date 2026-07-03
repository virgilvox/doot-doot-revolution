// Electron main process. Keeps the secure defaults on, serves the built SPA from
// a registered app:// scheme in production (so IndexedDB and cross-origin
// isolation work, unlike file://), and exposes two desktop-only capabilities over
// IPC: a CORS-free audio fetch, and a song library that lives as real .ddr files
// in a folder the user picks (contained to that folder, no arbitrary path access).

import { app, BrowserWindow, session, protocol, ipcMain, net, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

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

function registerIpc() {
  // Fetch remote audio bytes past the browser CORS wall.
  ipcMain.handle('audio:fetch', async (e, url) => {
    let proto; try { proto = new URL(url).protocol; } catch (err) { throw new Error('bad url'); }
    if (proto !== 'http:' && proto !== 'https:') throw new Error('only http(s) URLs are allowed');
    const r = await net.fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.arrayBuffer();
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
