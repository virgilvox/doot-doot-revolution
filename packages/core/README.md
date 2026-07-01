# @doot-games/core

Pub/sub bus and persisted settings. No DOM, no audio. These are the seams the
rest of the workspace talks through.

## API

### `createBus()`

Returns a synchronous event bus.

- `on(event, fn)` subscribes and returns an unsubscribe function.
- `once(event, fn)` subscribes for a single emit.
- `emit(event, data)` calls every handler. A handler that throws is caught and logged so it cannot break the emit.

### `createSettings({ key, defaults, storage })`

Persisted key/value settings. `storage` defaults to `localStorage` when present and is otherwise a no-op, so it is safe in tests and workers.

- `all()` returns a copy of the current state.
- `get(key)` reads one value.
- `set(key, value)` writes, persists, and notifies change listeners.
- `reset()` restores defaults.
- `onChange(fn)` subscribes to changes and returns an unsubscribe function.

## Example

```js
import { createBus, createSettings } from '@doot-games/core';

const bus = createBus();
const settings = createSettings({ defaults: { speed: 2.4, offsetMs: 0 } });

bus.on('judge', (j) => console.log(j.type));
settings.set('speed', 3.0);
```
