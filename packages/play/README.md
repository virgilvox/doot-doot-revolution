# @doot-games/play

The runtime gameplay primitives, as one private workspace package.

Members, each a file under `src/` re-exported from `index.js`:

- **engine** the Web Audio clock, which is the single source of song time (the
  renderer and the judge both read it), plus the hit and menu-cursor sounds and a
  looping, faded song preview (`preview`/`stopPreview`) for the select wheel,
  independent of the game clock.
- **input** keyboard and gamepad, with rebindable lanes and Start/Back, bridged to
  lane events.
- **judge** timing windows, scoring, combo, life, and hold logic. Pure, driven by
  song time, following the modern StepMania 5 / ITG rules.
