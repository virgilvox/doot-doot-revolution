# @doot-games/charter

Turn an analysis plus a tempo into a playable chart. Pure logic, no DOM, seeded so
the same inputs always produce the same chart.

## Method

Two stages, after the Dance Dance Convolution decomposition but using classical
signal processing rather than a trained net:

1. Placement. Quantize onsets to the difficulty's rhythmic grid, dedupe grid slots
   keeping the strongest, and thin to a notes-per-second cap.
2. Selection. Walk the placed rows assigning arrows with strict foot alternation.
   A foot only reaches panels on its own body side, so no crossover appears unless
   the tier's crossover probability adds one. Footswitches unlock the same way.
   Low tiers forbid both, which keeps beginner charts forward-facing.

Lane bias `drum` routes low band energy toward Down and high toward Up so arrows
track the drum kit. Lane bias `none` (Quick) ignores the bands and leans on
alternation and the home-side backbone only.

## API

- `DIFFS` the difficulty table: `beginner`, `basic`, `difficult`, `expert`, `challenge`, each with a foot rating, allowed subdivisions, and probabilities for jumps, crossovers, footswitches, and holds.
- `generate(analysis, tempo, options)` returns a chart. `options`: `difficulty`, `laneBias` (`drum` or `none`), `seed`, `engine`, `engineUsed`.
- `countJumps(notes)` count rows carrying two or more arrows.
- `nominalRadar(difficulty)` a preview radar for a difficulty before a chart exists.

## Chart shape

```
{ bpm, offset, difficulty, foot, meter, duration, engine, engineUsed,
  notes: [{ t, beat, lane, dur, quant, type, endBeat? }], count, radar }
```

Lanes are 0 Left, 1 Down, 2 Up, 3 Right. `t` and `dur` are seconds, `beat` is the
position in beats, `quant` is the note value (4, 8, 12, 16, 24, 32) used to color
the arrow. A jump is two notes sharing a `t`. A hold sets `type: 'hold'`, a
positive `dur`, and an `endBeat`.
