// library: the song store. Songs persist in IndexedDB so the app works offline
// with no server. A record keeps the original audio Blob (AudioBuffers are not
// serializable, so the app re-decodes on play) plus the generated charts.
//
// Two optional export paths sit alongside the store: a single portable .ddr
// backup file that works everywhere, and File System Access folder sync where
// the browser supports it.
//
// record = { id, title, artist, bpm, offset, source, createdAt, duration,
//            audio: Blob, charts: { [difficulty]: chart } }

export function createLibrary(options = {}) {
  const idb = options.indexedDB || (typeof indexedDB !== 'undefined' ? indexedDB : null);
  const DB = options.dbName || 'ddr', STORE = 'songs', VER = 1;
  let _db = null, _dir = null;
  const canFolder = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  const listeners = new Set();
  const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
  const fire = () => listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });

  function open() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      if (!idb) return rej(new Error('IndexedDB unavailable'));
      const r = idb.open(DB, VER);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }); };
      r.onsuccess = () => { _db = r.result; res(_db); };
      r.onerror = () => rej(r.error);
    });
  }
  function tx(mode) { return open().then((db) => db.transaction(STORE, mode).objectStore(STORE)); }
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function list() { return (await req((await tx('readonly')).getAll())) || []; }
  async function get(id) { return await req((await tx('readonly')).get(id)); }
  async function put(rec) { await req((await tx('readwrite')).put(rec)); fire(); return rec; }
  async function remove(id) { await req((await tx('readwrite')).delete(id)); fire(); }
  async function clear() { await req((await tx('readwrite')).clear()); fire(); }

  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  const dataURLToBlob = async (u) => await (await fetch(u)).blob();

  async function exportFile() {
    const songs = await list(), out = { format: 'ddr-library', version: 1, songs: [] };
    for (const s of songs) { const audio = s.audio ? await blobToDataURL(s.audio) : null; out.songs.push(Object.assign({}, s, { audio })); }
    return new Blob([JSON.stringify(out)], { type: 'application/json' });
  }
  async function importFile(file) {
    const data = JSON.parse(await file.text()); if (!data.songs) throw new Error('not a .ddr library');
    let n = 0;
    for (const s of data.songs) { const rec = Object.assign({}, s); rec.audio = s.audio ? await dataURLToBlob(s.audio) : null; await put(rec); n++; }
    return n;
  }

  async function chooseFolder() { if (!canFolder) throw new Error('unsupported'); _dir = await window.showDirectoryPicker({ mode: 'readwrite' }); return _dir.name; }
  function haveFolder() { return !!_dir; }
  async function exportToFolder() {
    if (!_dir) throw new Error('no folder');
    const songs = await list(); let n = 0;
    for (const s of songs) {
      const meta = Object.assign({}, s); delete meta.audio;
      let h = await _dir.getFileHandle(s.id + '.json', { create: true }), w = await h.createWritable(); await w.write(JSON.stringify(meta)); await w.close();
      if (s.audio) { h = await _dir.getFileHandle(s.id + '.audio', { create: true }); w = await h.createWritable(); await w.write(s.audio); await w.close(); }
      n++;
    }
    return n;
  }
  async function importFromFolder() {
    if (!_dir) throw new Error('no folder'); let n = 0;
    for await (const [name, handle] of _dir.entries()) {
      if (!name.endsWith('.json') || handle.kind !== 'file') continue;
      const meta = JSON.parse(await (await handle.getFile()).text());
      try { const af = await _dir.getFileHandle(meta.id + '.audio'); meta.audio = await af.getFile(); } catch (e) { meta.audio = null; }
      await put(meta); n++;
    }
    return n;
  }

  return { list, get, put, remove, clear, onChange, exportFile, importFile, chooseFolder, exportToFolder, importFromFolder, haveFolder, canFolder };
}
