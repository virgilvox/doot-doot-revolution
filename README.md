# Doot Doot Revolution

Home: **[doot.games](https://doot.games)** &nbsp;|&nbsp; A **[hack.build](https://hack.build)** project

A browser and desktop rhythm game in the DDR and StepMania tradition. Load a song,
analyze its tempo and onsets, generate step charts at several difficulties, review
and edit the result, and play it on keyboard or dance pad. The game is a Vue 3
single-page app that also packages as an Electron desktop app, built on a
workspace of small reusable libraries.

Everything runs client side. There is no server, no account, no telemetry.

## Run

```
npm install       # workspaces
npm run dev       # web dev server at http://localhost:4318
npm run build     # static web build (apps/web/dist)
```

Desktop:

```
npm run dev:desktop     # Vite plus an Electron window
npm run build:desktop   # web build, then electron-builder installers
```

## How it plays

The app opens on the Title screen. Press Start (Enter or a gamepad button) to reach
Song Select. Move through the wheel with Up and Down, confirm to open the
difficulty modal, pick a difficulty, and dance. Everything is reachable without a
mouse: arrow keys or a gamepad move focus, confirm and cancel map to Enter/Escape
and the first two face buttons, and Right on the Select screen moves onto the top
nav so a controller can reach every screen. In gameplay the four arrows are the
lanes, and a clean hit pops its receptor with a glow that grows the better the
timing, so a Marvelous reads louder than a Good.

Timing windows follow modern StepMania: Marvelous within 22.5ms, Perfect 45ms,
Great 90ms, Good 135ms, Boo 180ms. Scroll speed is XMOD, so a 2.4 multiplier
travels 2.4 note-heights per beat. Set a latency offset in Settings, with a tap
calibration to find it.

## Charting engines

Only engines with a working in-browser method exist: Quick (onset and tempo),
Drum-Aware (per-band onsets bias lane choice, the default), and Stem-Split
(isolates the drum stem over WebGPU, then charts the drums, falling back to
Drum-Aware when WebGPU is unavailable and reporting which path ran). There is no
neural step-author engine, because no in-browser step-placement model can be
loaded and run. The desktop build adds URL audio import past the CORS wall.

## Add a Song

Upload a local audio file, pick an engine and difficulties, and generate. The flow
ends in a compact review and edit step: scrub the chart, hear it against the
arrows, fix the mapping (add, remove, move, hold), then save. Any song in the
Library also exports to a StepMania `.sm` file.

## Import StepMania songs

The Add Song screen imports real StepMania simfiles. Point it at a song folder or a
whole pack folder (or pick the files directly) and it reads every dance-single
difficulty from the `.sm` or `.ssc`, pairs the audio, and saves it. The full tempo
map is honored: `#BPMS` changes and `#STOPS` are parsed and played back through a
beat-based timing model, so gimmick charts speed up, slow down, and freeze in sync
with the music. Column, mine, and other non-dance-single content is skipped, and
only the audio next to the simfile is used (nothing is fetched).

## Storage

On the web, songs you add live in the browser's IndexedDB, so the app is self
contained with no server, and a `.ddr` backup from the Library screen moves a
library between machines. In the desktop app, songs are saved as real `.ddr` files
in a folder you pick the first time you need one (one file per song), so your
library is ordinary files you can see, move, and back up, with a Reveal button to
open the folder. The demo songs are synthesized client side and are always
present. The library backend is pluggable (`@doot-games/library`), so the same app
code runs over IndexedDB or the filesystem; the Library screen detects the platform
and adapts.

## Repository layout

```
packages/        four framework-agnostic, private (unpublished) packages
  chart          dsp, analysis, charter, pipeline, simfile, radar, stems
  render         noteskin, notefield, editor
  play           engine, input, judge
  library        the song store
apps/web/        the Vue 3 app; also the Electron desktop target
tools/           shared test helpers
```

The four packages are self-contained (none imports another) and hold all logic and
rendering; the app wires them together and adds no game logic. No package touches
Vue or depends on the app. `chart` and `play` are pure logic and test in Node;
`render` draws to a canvas. Each package has its own README.

## Commands

```
npm test           # unit tests across the logic packages
npm run test:web   # Vue component tests (Vitest)
npm run test:all   # both
npm run build      # web build
npm run build:desktop  # Electron installers
```

## Deploy

The web build is a static single-page app. `.do/app.yaml` is a ready DigitalOcean
App Platform spec: it builds at the repo root (`npm ci && npm run build`) and
serves `apps/web/dist`. Any static host works the same way; there is no routing at
all (screens are state-driven), so no server rewrites are needed. See
`ARCHITECTURE.md` for how the web and desktop targets share one renderer.

## Releases

Pushing a version tag (`vX.Y.Z`) runs `.github/workflows/release.yml`, which builds
the Electron installers for macOS, Windows, and Linux and publishes them to a
GitHub Release. Code signing and macOS notarization turn on automatically once the
signing secrets are set; without them the build still produces unsigned installers.
`.github/workflows/ci.yml` runs the test suites and a web build on every push and
pull request.

## Contributing

See `CONTRIBUTING.md` for setup, workflow, and the pull request checklist, and read
`RULES.md` for the binding rules on code, docs, UI copy, and commit messages:
client side first, real methods only, small libraries and a thin app, documented
interfaces, and no AI attribution in commits.

## License

MIT. See `LICENSE`. Copyright (c) 2026 Moheeb Zara.
