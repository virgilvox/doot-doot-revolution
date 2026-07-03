# @doot-games/library

The song store. A record keeps the original audio Blob plus the generated charts.
AudioBuffers are not serializable, so the app re-decodes the blob on play.

The storage backend is pluggable. By default songs persist in IndexedDB, so the
web build works offline with no server. Pass a `store` of your own with the same
async CRUD to persist elsewhere; the desktop app passes a filesystem backend that
writes one `.ddr` file per song into a folder the user picks.

## Record shape

```
{ id, title, artist, bpm, offset, source, createdAt, duration,
  audio: Blob, charts: { [difficulty]: chart } }
```

## API

`createLibrary({ store?, indexedDB?, dbName? })` returns a store. `store` overrides
the default IndexedDB backend with any object exposing `list/get/put/remove/clear`.

- `list()`, `get(id)`, `put(record)`, `remove(id)`, `clear()` the core operations.
- `onChange(fn)` subscribe to writes. Returns an unsubscribe function.
- `exportFile()` returns a Blob for a single portable `.ddr` backup. `importFile(file)` restores one.
- `chooseFolder()`, `exportToFolder()`, `importFromFolder()`, `haveFolder()`, `canFolder` optional File System Access sync where supported.

The store depends on nothing else in the workspace and can be reused wherever a
blob-backed keyed record store is useful.
