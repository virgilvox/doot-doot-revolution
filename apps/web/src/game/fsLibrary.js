// The desktop library backend: songs as real .ddr files in a folder the user
// picks. It implements the same store interface @doot-games/library expects
// (list/get/put/remove/clear), so the rest of the app is identical to the web
// build. The main process only moves strings keyed by id; serializing a record
// (its audio Blob to a base64 data URL) and parsing it back stays here, where the
// browser globals live. The folder is asked for on first write and remembered.

const blobToDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataURLToBlob = async (u) => await (await fetch(u)).blob();

async function serialize(rec) {
  const audio = rec.audio ? await blobToDataURL(rec.audio) : null;
  return JSON.stringify(Object.assign({ format: 'ddr-song', version: 1 }, rec, { audio }));
}
async function deserialize(str) {
  const o = JSON.parse(str);
  o.audio = o.audio ? await dataURLToBlob(o.audio) : null;
  delete o.format; delete o.version;
  return o;
}

export function createFsLibrary(doot) {
  async function ensureDir() {
    let dir = await doot.lib.dir();
    if (!dir) dir = await doot.lib.choose();
    if (!dir) throw new Error('no library folder chosen');
    return dir;
  }
  return {
    kind: 'filesystem',
    async list() {
      const out = [];
      for (const s of await doot.lib.list()) { try { out.push(await deserialize(s)); } catch (e) { /* skip corrupt file */ } }
      return out;
    },
    async get(id) { const s = await doot.lib.read(id); return s ? await deserialize(s) : undefined; },
    async put(rec) { await ensureDir(); await doot.lib.put(rec.id, await serialize(rec)); return rec; },
    async remove(id) { await doot.lib.remove(id); },
    async clear() { for (const s of await doot.lib.list()) { try { const o = JSON.parse(s); if (o.id) await doot.lib.remove(o.id); } catch (e) { /* skip */ } } }
  };
}
