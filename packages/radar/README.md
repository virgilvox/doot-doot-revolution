# @doot-games/radar

The five axis groove radar. Compute it from a chart or draw a radar object as SVG.
Axes are stream, voltage, air, freeze, and chaos, each in the range 0 to 1.

## API

- `AXES` the axis keys and their display labels.
- `computeRadar(chart)` derive the radar from a chart's notes and foot rating. Stand-alone, so a chart loaded from disk gets a radar without re-running the charter.
- `radarSVG(radar, opt?)` inner SVG markup for a 168 by 168 viewBox. Colors use the `--purple` and `--ink` CSS variables.

Stream tracks notes per second, voltage the foot rating, air the jump rate,
freeze the hold rate, and chaos the share of fast (16th and finer) notes.
