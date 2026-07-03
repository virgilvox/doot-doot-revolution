# @doot-games/simfile

Read and write StepMania `.sm` and `.ssc` files and the native Doot song package.
Pure string work, no DOM.

## StepMania read and write

`toSM(chart, meta?)` serializes one chart. `songToSM(record)` serializes a whole
song record, writing every difficulty chart under a single song header the way
StepMania groups them.

`parseSimfile(text)` reads a `.sm` or `.ssc` (auto-detected) into a song record:
`{ title, artist, bpm, offset, bpms, stops, music, charts }`, with every
dance-single difficulty under `charts`. It parses the full tempo map (`#BPMS` and
`#STOPS`, and per-chart overrides in `.ssc`) and times each note through a
`createTiming` map, so BPM changes and stops import in sync. `parseSSC(text)` is
the `.ssc`-specific reader. `parseSM(text)` remains for the single first chart,
returning `{ title, artist, bpm, offset, bpms, stops, difficulty, notes }`.

Note characters follow the spec: `0` empty, `1` tap, `2` hold head, `3` hold or
roll tail, `4` roll head, `M` mine. Column order is Left, Down, Up, Right.
Measures are comma-delimited, each four beats subdivided evenly by its row count
up to 192 rows. `#OFFSET` is written as the negative of the first-beat offset,
matching StepMania where a negative offset means the audio leads in before beat 0.

`meta` may set `title`, `artist`, `author`, `music`, and `musicExt`. Drop the
audio into the song folder named to match `#MUSIC`.

## Native package

`toPackage(record, opts?)` writes a JSON envelope for full-fidelity round trips
including edits. `parsePackage(json)` reads it back. Audio rides along as a base64
data URL when `opts.audio` is supplied, or is left out for a metadata-only
package. This is the format that preserves everything the browser library record
holds.
