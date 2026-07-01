# @doot-games/engine

Web Audio playback and the master song clock. The audio hardware clock
(`ctx.currentTime`) is the single source of truth for song time, so audio and
visuals never drift.

## API

`createEngine()` or `new AudioEngine()` returns an engine with:

- `ensure()` / `resume()` create and unlock the audio context. `resume()` returns a promise.
- `latencyMs()` the output latency in milliseconds, a first guess for the judge offset.
- `setVolumes({ master, music, sfx })` set gain on the three buses.
- `decode(arrayBuffer)` decode to an `AudioBuffer`.
- `load(buffer)` set the current buffer.
- `play(fromSec?)` start playback and the clock. `stop()` halts both.
- `time()` current song time in seconds. `duration()` the buffer length.
- `beat(bpm, offsetSec)` beat position at the current time.
- `onended(fn)` callback when the source ends.
- `tick()` a short blip on the sfx bus for hit feedback.

The engine holds no game logic and reads no settings. The app sets volumes from
its own settings.
