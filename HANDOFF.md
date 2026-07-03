# Handoff

State of Doot Doot Revolution and how to pick it up. Read `README.md`,
`CLAUDE.md`, and `RULES.md` first; this file is the working orientation.

## What it is now

A DDR/StepMania-style rhythm game as a Vue 3 + Vite single-page app that also
packages as an Electron desktop app. All game logic and rendering live in 16
framework-agnostic `@doot-games/*` packages. Every package is published on npm at
0.1.0; eight packages are bumped in the workspace but not yet republished (see
Publishing): `notefield` and `simfile` at 0.1.2, and `engine`, `ui`, `input`,
`library`, `noteskin`, and `charter` at 0.1.1. The Vue app in `apps/web`
is a thin layer of views,
composables, and stores over those packages. There is no landing page: the app
opens on the Title attract screen.

The earlier vanilla single-file app (`apps/ddr`) was retired; the packages remain
the proof the logic is framework-free.

Current status: builds clean, 49 tests pass (44 package, 5 Vue), verified end to
end in the browser (controller-only play, difficulty modal, viewport-fit gameplay
with the game-feel pass, add/review/save, all menus). No console errors.

## Run, build, test

```
npm install            # workspaces
npm run dev            # web dev server at http://localhost:4318
npm run build          # web build (apps/web/dist)
npm run dev:desktop    # Vite inside an Electron window
npm run build:desktop  # electron-builder installers (needs a desktop OS; dmg needs macOS)
npm test               # 44 package unit tests (node --test)
npm run test:web       # 5 Vue component/nav/store tests (Vitest)
npm run test:all       # both
```

## Layout

```
packages/    core dsp analysis charter pipeline stems simfile engine input judge
             noteskin notefield radar editor library ui   (published @doot-games)
apps/web/    Vue 3 app; electron/ is the desktop target; electron-builder.yml
tools/       shared test helpers (testutil.mjs, fakecanvas.mjs)
```

## App architecture (apps/web)

- `src/game/singletons.js` creates the shared bus, settings, engine, input, and
  library once. Nothing else instantiates them.
- Composables are the seam to the imperative packages:
  - `useInput` attaches input once, runs one global rAF, and bridges raw lane and
    start/back events into `move`/`confirm`/`cancel` (nav) plus `lane:down`/`lane:up`
    (gameplay), including gamepad face buttons for confirm/cancel.
  - `useNavigation` is a focus-scope stack; only the top scope receives nav events,
    which gives modal focus trapping. `useScope(handlers)` pushes/pops with a view.
  - `useRovingFocus(opts)` is the reusable focused-index helper (size, onConfirm,
    onAdjust, onCancel, cols) used by Settings, Pads, Library, and Results so a
    controller can operate them with a visible `.kfocus` ring.
  - `useSession` owns one play: builds a Judge, runs the countdown, drives the rAF
    loop, and holds the abort-epoch guard. The Judge, chart, and song are `markRaw`
    so Vue does not deep-proxy them in the 60fps loop.
  - `useChart`, `usePlatform` (web vs desktop capabilities).
- Pinia stores: `settings`, `library`, `songs`.
- Canvas packages are wrapped: `NoteField.vue`, `ChartEditor.vue`, `GrooveRadar.vue`.
- No router: screens are swapped by state (`game/screen.js`, read `screen`, call
  `go`), so there are no route URLs, browser Back never interrupts a song, and one
  build runs as a static site and inside Electron with nothing to keep in sync.

## Controller-first navigation

The whole app is operable with no mouse. On Select, Up/Down move the wheel, Right
moves onto the top nav (shared `game/navFocus.js` signal) so Add, Library,
Settings, and Pads are reachable, and confirm dances or opens the nav target. Every
menu screen shows a focus ring. Gameplay maps the four arrows to the lanes.

## Electron

Web-first via `vite-plugin-electron` (electron 31, electron-builder 24). `main.js`
keeps the secure defaults on, serves the packaged SPA from a registered `app://`
secure scheme (so IndexedDB and cross-origin isolation work, unlike `file://`),
sets COOP/COEP headers, restricts navigation and window-open, and exposes desktop
capabilities over IPC: CORS-free audio fetch (http(s) only), native dialogs, and
filesystem access (path-contained). `preload.js` bridges them as `window.doot`.

## Audit results folded in

Two review passes ran (UI/color/accessibility and Vue/Electron correctness). Fixed:

- Menu-screen headings were white on the paper body (near invisible); now ink.
- Muted grays darkened for AA contrast.
- Settings, Pads, Library, Results, and the top nav were not controller-operable;
  now navigable with `useRovingFocus` and a visible focus ring.
- Session `reactive()` was deep-proxying the Judge and chart every frame; `markRaw`.
- Difficulty modal could still launch the game if cancelled during generation; guarded.
- Electron `app://` path traversal, `audio:fetch` scheme allowlist, and navigation
  restrictions added.
- Reduced motion now honored from the OS setting, not only the in-app toggle.
- Add columns collapse on phones; the difficulty modal scrolls on short viewports;
  the Select frame is height-capped.

## Game feel

Feedback is a rendering concern, so it lives in `@doot-games/notefield` (and the
engine for sound), keeping logic pure. A hit stacks channels and scales them by
the judgment (accumulation, not substitution): receptor pop, spark burst,
expanding ring, a judgment word scaled by tier, a combo counter that punches per
increment and celebrates every 50th, and a brighter hit tick for a better hit. A
miss gives a restrained red field-tint at the edges. Receptors pulse to the beat
as a timing anchor. `notefield.setReducedMotion(true)` trims the cosmetic motion
while keeping essential feedback, wired to the reduced-motion setting.

Deliberate omissions, grounded in game-feel research: no screen shake and no
hit-stop on the note field. Both hurt readability on a precision field and desync
the read, so decoration surrounds the field and never moves the notes. This was a
design choice, not an oversight. If a screen-shake option is ever added, gate it
behind a default-low intensity slider and apply it to a background layer only.

Arrow color follows the Dance Dance Revolution "Note" scheme, by beat not by lane:
4th red, 8th blue, 12th green, 16th gold (24th and 32nd kept distinct in
`@doot-games/noteskin`). The notefield draws each note with `colorFor(n.quant)` and
uses the lane only for rotation, so a jump is one color. The per-direction palette
is decoration for menu specimens only. Cycling the song wheel plays a soft
`engine.cursor` blip (SelectView watches `songs.sel`).

Next feel ideas (not done): an osu-style hit-error bar with running deviation, a
combo-to-score multiplier, escalating milestone tiers, and pitch-rising ticks per
combo step.

## Dev note: linked packages are excluded from Vite pre-bundling

`apps/web/vite.config.js` lists every `@doot-games/*` package in
`optimizeDeps.exclude`. Without this, Vite pre-bundles a linked package into
`.vite/deps` and keeps serving that snapshot, so a newly added export (this bit us
with `notefield.setReducedMotion`) appears missing in `npm run dev` until the cache
is force-cleared. Excluding them makes Vite serve the workspace source live with
HMR. The production build (Rollup) was never affected.

## StepMania import and variable BPM

Real StepMania simfiles import from the Add Song screen (a song folder, a whole
pack folder, or hand-picked files). `game/importSimfile.js` groups the file list by
folder, parses each `.sm`/`.ssc` with `simfile.parseSimfile`, pairs the audio,
computes a radar, and saves a library song. Every dance-single difficulty comes in;
a difficulty the pack lacks still auto-generates from the audio on first play.

The timing model is the core of it. A chart is authored in beats with a tempo map
(`bpms`, `stops`), and `charter.createTiming(chart)` converts beat to second and
back through every BPM change and stop. Two consequences:
- `simfile` times each imported note through the map, so `note.t` (and hold `dur`)
  are correct across gimmicks. The judge, which works in seconds, needs no change.
- the notefield scrolls in beats (XMOD): a note sits at `(note.beat - currentBeat)
  * pixelsPerBeat`, and `useSession` feeds `currentBeat = timing.timeToBeat(t)` each
  frame. So notes speed up, slow down, and freeze with the music. A constant-tempo
  chart is the one-segment case and renders exactly as before; the editor keeps its
  own constant-BPM math since it only edits generated charts.

Verified end to end in the browser: a synthesized `.sm` with a BPM change and a stop
imported with note times `[0, 500, 1000, 1500, 2000, 3000] ms` (the last proving the
stop and speed-up both applied), saved to the library, and played back.

Six StepMania difficulty classes fold onto five slots (Hard and Edit both map to
expert); a collision moves the loser to the nearest free slot, so a chart is dropped
only when all five are full. Not yet handled: `.ssc` warps and negative BPMs,
non-`dance-single` game types, and `.zip` packs (extract first, then pick the
folder). `timeToBeat` is a per-frame linear scan, fine for real charts but
O(events) on a heavy gimmick chart; a cached cursor would make it O(1).

## Release and deploy

- `.github/workflows/ci.yml` runs both test suites and a web build on every push
  and pull request.
- `.github/workflows/release.yml` builds the Electron installers for macOS,
  Windows, and Linux on a `vX.Y.Z` tag and publishes them to a GitHub Release via
  electron-builder. Signing and notarization are gated on repo secrets (listed in
  the workflow header): with none set the build still succeeds, unsigned; set
  `CSC_LINK`/`CSC_KEY_PASSWORD` to sign, and the `APPLE_*` secrets plus
  `mac.notarize: true` to notarize. macOS entitlements live at
  `apps/web/build/entitlements.mac.plist`.
- `.do/app.yaml` is a DigitalOcean App Platform static-site spec: it builds at the
  repo root and serves `apps/web/dist`. Any static host works the same; hash
  routing needs no rewrites.
- Storage adapts by platform through one pluggable backend in `@doot-games/library`.
  The web deploy persists in IndexedDB (self contained, no server). The desktop app
  saves one `.ddr` file per song into a folder the user picks on first use, over a
  path-contained IPC bridge (renderer adapter in `game/fsLibrary.js`; main handlers
  in `electron/main.js`). Demos are synthesized client side either way. `usePlatform`
  reports which model is active plus the other capabilities that differ (URL import
  on desktop, File System Access folder sync on Chromium web), and the Library
  screen adapts its copy and controls. A `.ddr` backup moves a library anywhere.

## Cleanup folded in (public-release audit)

A cleanliness pass removed dead surface and reconciled docs with reality: dead
exports (`escapeHtml`, `drawRadar`, `createJudge`, noteskin `LANE_NAMES`, the
`countJumps` export), the `library` store's leaky `store:` escape hatch (views now
use `remove`/`put`/`get` actions), and stale references to the retired vanilla app
and single-file bundler. The old unused Electron filesystem IPC bridge (which took
uncontained renderer paths) was deleted; a path-contained one was then
reintroduced deliberately to back the desktop filesystem library. The `.sm` export
is now real: `@doot-games/simfile` gained `songToSM(record)` and the Library screen
exports any song's charts as one StepMania `.sm`. Bumped in the workspace (not yet
republished): `notefield`, `engine`, `ui`, `input`, `simfile`, and `library` at
0.1.1.

## Known limitations and next steps

- Saving a song from a URL import keeps the fetched bytes as a generic blob; a real
  save should preserve the original container/type.
- `stems` (WebGPU drum isolation) is feature-detected and untested on hardware here;
  it falls back to drum-aware and the review reports the path.
- Electron packaging was verified to bundle main and preload; a full packaged launch
  and code signing need a desktop session and certificates (CI matrix for all three
  OSes).
- The desktop filesystem library is wired, built (all 8 IPC channels match between
  main and preload), and its backend is unit-tested, but the interactive first-run
  folder prompt and the on-disk read/write round trip were not verified in a running
  Electron window (the browser test harness cannot drive Electron). Run
  `npm run dev:desktop`, open Library or add a song, pick a folder, and confirm the
  `.ddr` files appear and reload.
- Eight packages are bumped in the workspace but not yet republished to npm:
  `notefield` 0.1.2 (juice plus beat-space scrolling) and `simfile` 0.1.2 (`.ssc`,
  full tempo map, `parseSimfile`); and at 0.1.1 `engine` (`tick(freq)` plus the
  `cursor` blip), `ui` (contrast, stage check, underline reset), `input` (unbound
  label), `library` (pluggable store), `noteskin` (DDR palette), and `charter`
  (`createTiming` plus `bpms`/`stops` on charts). `simfile` now depends on `charter`.
  The workspace links pick them up locally; republish when ready.
- Component test coverage is smoke-level. Deeper tests for the roving focus and the
  session loop would help.

## Git state

Branch `main`, remote `github.com/virgilvox/doot-doot-revolution`. The only commit
so far is `d39dc84 add the initial workspace, libraries, and single-file app`,
which is the original vanilla single-file build.

Everything since (the Vue app in `apps/web`, the Electron target, the two audit
passes and their fixes, the game-feel pass, the retirement of `apps/ddr`, and the
doc updates) is UNCOMMITTED in the working tree: about two dozen changed, added,
and deleted paths. Nothing here is pushed. First step for whoever picks this up is
to review and commit this work (imperative subject, no AI attribution per
`RULES.md`), for example a commit that adds the Vue app and desktop target and
removes the vanilla app.

## Publishing

`@doot-games/*` packages are on npm at 0.1.0. Five are at 0.1.1 locally
(`notefield`, `engine`, `ui`, `input`, `simfile`); republish them when ready.
To publish from the repo root: `npm publish --workspaces --access public` (the app
is private and is skipped). Bump versions first per semver; dependents pin `^0.1.0`,
which is satisfied by a 0.1.x bump.

## Rules reminder

Commits are imperative, no emojis, and carry no AI attribution or co-author trailer
for an assistant. Follow the writing rules in `RULES.md` for all copy and comments.
