# @doot-games/notefield

The scrolling notefield on a canvas. Upscroll, receptors near the top, notes
rising from below to meet them, driven entirely by song time. Depends on
`@doot-games/noteskin`. Used by gameplay and, in a narrow variant, by the editor.

## Scroll

Scroll speed is XMOD, matching StepMania. A note `beats_away` from now sits
`beats_away * speed` note-heights past the receptor, so pixels per second =
`(bpm / 60) * speed * noteSize`. A speed of 2.4 travels 2.4 note-heights per beat.

## API

`createNotefield(canvas, config?)` returns a renderer.

- `observe()` start a ResizeObserver and size the canvas. `resize()` sizes once. `disconnect()` stops observing.
- `render(time, chart, opts?)` draw one frame. `opts`: `speed`, `judge`, `held` (per-lane key-down array), `beats`, `showFeedback`.
- `blast(lane, color, songTime)` push an expanding hit ring.
- `geom()`, `laneX(i)`, `pps(chart, speed)`, `yAtTime(t, now, chart, speed)`, `timeAtY(y, now, chart, speed)` geometry helpers for hit-testing, used by the editor.

`config`: `recFrac` (receptor position, default 0.18 from the top), `maxGap`,
`maxLaneW`, `spread`, `minRecY`. When a `judge` is passed it must be built from
the same chart, so its tracking array lines up by index and the renderer culls
judged notes and draws holds and center feedback.
