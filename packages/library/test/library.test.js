import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLibrary } from '@doot-games/library';

// An in-memory backend that satisfies the store interface, standing in for
// IndexedDB (browser) or the desktop filesystem store.
function memStore() {
  const m = new Map();
  return {
    kind: 'memory',
    list: async () => [...m.values()],
    get: async (id) => m.get(id),
    put: async (r) => { m.set(r.id, r); return r; },
    remove: async (id) => { m.delete(id); },
    clear: async () => { m.clear(); }
  };
}

test('a custom store backend drives the library CRUD and fires onChange', async () => {
  const lib = createLibrary({ store: memStore() });
  assert.equal(lib.backend, 'memory');
  let fired = 0; lib.onChange(() => fired++);
  await lib.put({ id: 'a', title: 'A' });
  await lib.put({ id: 'b', title: 'B' });
  assert.equal((await lib.list()).length, 2);
  assert.equal((await lib.get('a')).title, 'A');
  await lib.remove('a');
  assert.equal((await lib.list()).length, 1);
  assert.ok(fired >= 3, 'each write fires onChange');
  await lib.clear();
  assert.equal((await lib.list()).length, 0);
});
