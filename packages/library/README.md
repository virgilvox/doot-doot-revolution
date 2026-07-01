# @doot-games/library

The song store. Songs persist in IndexedDB so the app works offline with no
server. A record keeps the original audio Blob plus the generated charts.
AudioBuffers are not serializable, so the app re-decodes the blob on play.

## Record shape

```
{ id, title, artist, bpm, offset, source, createdAt, duration,
  audio: Blob, charts: { [difficulty]: chart } }
```

## API

`createLibrary({ indexedDB?, dbName? })` returns a store.

- `list()`, `get(id)`, `put(record)`, `remove(id)`, `clear()` the core operations.
- `onChange(fn)` subscribe to writes. Returns an unsubscribe function.
- `exportFile()` returns a Blob for a single portable `.ddr` backup. `importFile(file)` restores one.
- `chooseFolder()`, `exportToFolder()`, `importFromFolder()`, `haveFolder()`, `canFolder` optional File System Access sync where supported.

The store depends on nothing else in the workspace and can be reused wherever a
blob-backed keyed record store is useful.
