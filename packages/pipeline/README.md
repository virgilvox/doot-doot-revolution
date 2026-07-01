# @doot-games/pipeline

The chart engine router. Picks the analysis path for the chosen engine, awaits any
heavy model, applies fallback, reports progress through hooks, and runs the charter
for each requested difficulty. Depends on `analysis`, `charter`, and `stems`.

## Engines

Only engines with a working in-browser method exist:

- `quick` onset and tempo, lane bias off, fast.
- `drum` per-band onsets bias lane choice. The default.
- `stem` isolate the drum stem over WebGPU, then chart the drums. Falls back to `drum` on the full mix when WebGPU is unavailable, and the result records which path actually ran through `engineUsed`.

There is no neural step-author engine, because no in-browser step-placement model
can be loaded and run.

## API

- `ENGINES` the engine descriptors.
- `generate(source, options?, hooks?)` returns `{ charts, engineUsed, analysis, tempo }`. `source`: `{ buffer, analysis?, tempo?, title? }`. `options`: `engine`, `difficulties[]` or `difficulty`, `bpm?`, `seed?`. `hooks`: `stage(name)`, `progress(0..1, msg)`, `status(msg)`.
- `generateChart(source, options?, hooks?)` generate one difficulty and return the chart.

`engineUsed` is how the review step reports the path that ran, for example
`stem-split (drums isolated)` or `drum-aware (stem fallback)`.
