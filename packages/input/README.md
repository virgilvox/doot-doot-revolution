# @doot-games/input

Unified keyboard and Web Gamepad input, rebindable per lane. Lanes are 0 Left,
1 Down, 2 Up, 3 Right.

## API

`createInput({ storage?, key? })` returns an input controller.

- `on(event, fn)` subscribe. Events: `down` `{ lane }`, `up` `{ lane }`, `start`, `back`, `bound` `{ lane }`. Returns an unsubscribe function.
- `attach(target?)` bind keyboard listeners (defaults to `window`). `detach()` removes them.
- `poll()` sample gamepads. Call once per frame.
- `isDown(lane)` / `laneDown()` current key-down state, for hold handling.
- `bindings()` the current binding map. `describe(lane)` a readable label.
- `listen(lane)` capture the next key or pad button for a lane. `cancelListen()` aborts.
- `setPadEnabled(v)` / `padEnabled()` toggle gamepad reading. `connectedPad()` the first connected pad or null.
- `reset()` restore the arrow-key defaults.

A slot holds one key and one gamepad button. Bindings persist to the store
(localStorage by default) and default to arrow keys, Enter for start, Escape for
back. Consumers read the song clock inside the `down` handler for hit timing.
