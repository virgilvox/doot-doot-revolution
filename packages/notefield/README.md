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
- `hit(lane, judgment, songTime)` register a judged hit. This is the game-feel entry point: it pops the receptor (raise plus glow), rings the lane, and sprays a spark burst, all scaled by the judgment so a Marvelous reads louder than a Good (accumulation, not substitution). Non-scoring judgments (boo, miss) do nothing.
- `blast(lane, color, songTime, strength?)` push an expanding hit ring directly. `hit` is the higher-level entry most callers want.
- `setReducedMotion(bool)` trims the cosmetic juice (sparks, receptor beat-pulse, miss field-tint) while keeping the essential feedback (receptor pop, judgment word, combo). Wire it to the reduced-motion setting.

## Game feel

The renderer carries the feel, not just the notes. A hit stacks several small
feedback channels at once and scales them by the judgment: a receptor pop, a spark
burst, an expanding ring, a judgment word that scales up and is sized by tier, and
a combo counter that punches on each increment and celebrates every fiftieth. A
miss gives a brief, restrained red field-tint at the edges (never over the notes).
Receptors pulse gently to the beat as a timing anchor. There is deliberately no
screen shake or hit-stop: shaking or freezing a precision note field hurts
readability and desyncs the read, so the juice lives in decoration around the
field, never in the field's motion.
- `geom()`, `laneX(i)`, `pps(chart, speed)`, `yAtTime(t, now, chart, speed)`, `timeAtY(y, now, chart, speed)` geometry helpers for hit-testing, used by the editor.

`config`: `recFrac` (receptor position, default 0.18 from the top), `maxGap`,
`maxLaneW`, `spread`, `minRecY`. When a `judge` is passed it must be built from
the same chart, so its tracking array lines up by index and the renderer culls
judged notes and draws holds and center feedback.
