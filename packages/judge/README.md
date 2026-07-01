# @doot-games/judge

Timing windows, judgment, scoring, combo, life, and hold handling. Pure logic
driven by song time, no DOM and no audio. The renderer reads its public fields
(`lastJudge`, `combo`, `holdActive`, `life`, `score`) each frame.

## Windows

Half-windows in seconds, the modern StepMania 5 defaults verified against
`src/Player.cpp`:

| Judgment | half-window |
|---|---|
| Marvelous | 22.5 ms |
| Perfect | 45 ms |
| Great | 90 ms |
| Good | 135 ms |
| Boo | 180 ms |

Freeze release grace is 0.25 s: a hold may be released for up to that long before
it drops. Combo follows ITG: Marvelous, Perfect, and Great keep it; Good, Boo, and
Miss break it.

## API

`new Judge(chart, options?)` or `createJudge(chart, options?)`.

- `hit(lane, t)` register a tap at song time `t`. Returns the judgment name or null.
- `update(t, held)` advance to song time `t`; `held` is the per-lane key-down array, used for the freeze grace. Sweeps missed taps and finishes or drops holds.
- `accuracy()` percent over the note total. `results()` the end-of-song summary with counts, `maxCombo`, `score`, `accuracy`, `grade`, and `fullCombo`.
- `WINDOWS`, `HOLD_GRACE`, and `gradeFor(accuracyPct)` are exported for reuse.

Options: `maxScore` (default 1000000), `onJudge(event)`, and `now()` for a
deterministic clock in tests. Score is accuracy over the note total plus a flat
bonus per freeze fully held, kept in one place so a completed hold and a judged
tap agree.
