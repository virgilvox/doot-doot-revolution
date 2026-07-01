# @doot-games/noteskin

The StepMania arrow silhouette and its coloring, drawn to a 2D canvas or returned
as an SVG string. One geometry, reused everywhere so arrows look identical across
menus, the notefield, and the editor.

## Coloring

Notes are tinted by rhythmic quantization, the StepMania convention: 4th red, 8th
blue, 12th purple, 16th green, 24th magenta, 32nd orange. Directions are tinted
per lane for menu specimens.

## API

- `QUANT`, `DIR` color stops keyed by quantization value and by direction.
- `LANE_ROT`, `LANE_NAMES`, `LANE_DIRS` lane order is Left, Down, Up, Right.
- `colorFor(key)` the `{ t, b }` gradient stops for a quant or direction key.
- `shade(hex, percent, alpha)` shade a color toward white or black as rgba.
- `drawArrow(ctx, x, y, size, key, rot, opt?)` draw a note or receptor. `opt`: `alpha`, `glow`, `receptor`.
- `drawTrail(ctx, x, topY, botY, key, width)` draw a hold body with chevrons.
- `arrowSVG(dir, key?)` inline SVG string for specimens.

`Path2D` is browser only, so the canvas paths build lazily. The module imports
cleanly in Node, which keeps the SVG helpers and constants testable and lets the
bundler read the file without a DOM.
