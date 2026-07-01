# @doot-games/stems

Optional WebGPU drum-stem isolation. This is the one path that runs a real neural
model in the browser: a source-separation model (Demucs) loaded over WebGPU. It
is heavy and needs WebGPU plus cross-origin isolation, so it is feature detected
and everything loads dynamically. Nothing here runs unless you call it.

## API

- `isSupported()` true when the browser exposes WebGPU.
- `isolateDrums(buffer, options?)` returns an AudioBuffer-like mono object of the isolated drums, or `null` to signal the caller should fall back to the full mix. On any failure it returns `null` rather than throwing. `options`: `onStatus(msg)`, `onProgress(0..1)`.

The null return is the contract: callers chart the isolated drums when they get a
buffer and chart the full mix when they get null. Because the model loads via
dynamic import, packages that never call `isolateDrums` add no weight.
