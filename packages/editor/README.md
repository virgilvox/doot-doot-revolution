# @doot-games/editor

The embeddable review and edit widget. It shows a narrow vertical notefield strip
that mirrors gameplay orientation, a density timeline with a draggable playhead, a
small toolbar, and a readout. The whole thing fits in its container with no page
scroll. Depends on `@doot-games/notefield` and `@doot-games/noteskin`.

## API

`createEditor(container, options)` mounts the editor and returns a handle.

Options:

- `charts` a map of difficulty to chart. Edited copies are made internally.
- `difficulty` the initial active difficulty.
- `audioBuffer` the decoded audio, for synced playback.
- `audioContext` optional; one is created if absent.
- `onChange(charts)` called after every edit with the current charts.
- `speed` initial scroll speed.

Returns `{ getCharts(), setDifficulty(df), destroy(), active }`.

## Interactions

- Scrub with the wheel over the strip, by dragging the timeline, or with the arrow keys.
- Play and pause with the button or space, audio synced to the visual.
- In Edit mode, click a lane to add or remove an arrow, drag an arrow to move it, and drag down from an arrow to make or resize a hold. In Select mode, click an arrow to delete it.
- Change the snap (4th, 8th, 12th, 16th) to place off-grid steps deliberately.
- Undo and redo. Edits are non-destructive until the host saves.
- Switch difficulty tabs to edit each chart independently.

It can embed anywhere a compact chart preview or editor is useful, not only in Add
a Song.
