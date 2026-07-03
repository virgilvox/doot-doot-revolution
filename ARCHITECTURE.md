# Architecture

The whole system is two layers with one rule between them.

1. **Libraries** (`packages/*`): sixteen small, framework-agnostic modules that hold
   all the game logic and rendering, published under `@doot-games`.
2. **App** (`apps/web`): a thin Vue 3 layer of views, composables, and stores over
   those libraries, which also packages as an Electron desktop app from the same
   renderer.

**The rule:** logic packages never touch the DOM and never import the app. The
browser globals they legitimately need (canvas, audio, storage) are confined to the
I/O packages. Nothing under `packages/` imports `apps/web`. This is what lets the
same engine run in a browser tab, an Electron window, and a Node test.

## The libraries

Grouped by role, with the dependency direction pointing rightward (a package may
use those to its left, never the reverse):

- **Primitives:** `dsp` (FFT, windows, onset math), `core` (event bus, settings).
- **Analysis and authoring:** `analysis` (tempo and onset detection), `charter`
  (turn analysis into step charts, plus `createTiming`, the beat-to-second map),
  `stems` (optional WebGPU drum isolation), `pipeline` (orchestrates analyze then
  chart), `simfile` (read and write StepMania `.sm` and `.ssc`, full tempo map),
  `radar` (the five-axis groove radar).
- **Play:** `judge` (timing windows, scoring, combo, life, holds; pure logic driven
  by song time), `engine` (the Web Audio clock and hit sounds), `input` (keyboard
  and gamepad to lane events and bindable controls).
- **Rendering:** `noteskin` (the one arrow silhouette and its coloring), `notefield`
  (the scrolling play field on a 2D canvas, where the game feel lives), `editor`
  (the chart editor canvas), `library` (IndexedDB store plus `.ddr` backup and
  optional folder sync).
- **Design language:** `ui` (the stylesheet as a string, tokens, and small DOM
  helpers).

Each package has a README documenting its public interface. Logic packages are
intentionally terse; correctness lives here and is covered by `node --test` suites.

## The app

The Vue layer stays thin. It composes the libraries and owns only what a UI owns:
routing, reactive view state, and layout.

- **`game/singletons.js`** constructs the shared, stateful instances once: the event
  bus, settings, audio engine, input, and library. Nothing else instantiates them.
- **Composables are the seam** to those imperative singletons:
  - `useInput` attaches input once, runs one global animation frame, and bridges raw
    lane and start/back events into `move`/`confirm`/`cancel` for menus and
    `lane:down`/`lane:up` for gameplay.
  - `useNavigation` is a stack of focus scopes; only the top scope receives nav
    events, which gives modal focus trapping. `useRovingFocus` is the reusable
    focused-index helper every menu uses, with a visible focus ring, so a controller
    drives the whole app with no mouse.
  - `useSession` owns one play: it builds a `Judge`, runs the countdown, drives the
    render loop, and holds an abort guard so quitting mid-countdown is safe. The
    judge, chart, and song are `markRaw` so Vue does not deep-proxy them at 60fps.
  - `useChart` generates and persists charts; `usePlatform` reports the capabilities
    that differ between web and desktop.
- **Stores** (Pinia) hold cross-view reactive state: `settings`, `library`, `songs`.
- **Canvas wrappers** (`NoteField.vue`, `ChartEditor.vue`, `GrooveRadar.vue`) mount
  the rendering packages, size them with a ResizeObserver, and clean up on unmount.

## Web and desktop from one renderer

There is one renderer. Electron is a second build target, not a fork.

- **Web:** a static single-page app with hash routing, so it deploys to any static
  host with no server rewrites.
- **Desktop:** Electron with the secure defaults left on (context isolation on, node
  integration off, sandbox on). The packaged app serves the SPA from a registered
  `app://` secure scheme, because `file://` disables IndexedDB and cross-origin
  isolation; `app://` restores both and gives clean routing. The only privilege the
  renderer gets is a main-process audio fetch that bypasses the CORS wall.

**Storage adapts through one interface.** The `library` package takes a pluggable
backend exposing `list/get/put/remove/clear`. The web build uses the default
IndexedDB backend, so it persists with no server. The desktop build injects a
filesystem backend (`game/fsLibrary.js`) that writes one `.ddr` file per song into
a folder the user picks on first use, over a path-contained IPC bridge; the
renderer serializes each record (audio to a base64 data URL) so the main process
only moves strings. The demo songs are synthesized client side and exist on every
target. `usePlatform` reports which model is active and the other capabilities that
vary (URL audio import on desktop, File System Access folder sync on Chromium
web), and a portable `.ddr` backup moves a library between machines anywhere.

## Timing

A chart is authored in beats with a tempo map: `bpms` and `stops`. `charter`'s
`createTiming(chart)` is the one place beats and seconds convert, honoring every
BPM change and stop; a generated chart is the single-segment case. From it,
everything else follows: `simfile` times each imported StepMania note through the
map (so the judge, which works in seconds, needs no timing knowledge), and the
notefield scrolls in beats (XMOD) using a `currentBeat` the session feeds it each
frame, so notes speed up, slow down, and freeze exactly with the music. Keeping the
map in one function is what makes gimmick charts work without threading BPM logic
through every layer.

## Game feel

Feedback is a rendering concern, so it lives in `notefield` (and `engine` for
sound), keeping the logic pure. A hit stacks several channels scaled by the
judgment: a receptor pop, a spark burst, an expanding ring, a judgment word sized by
tier, a combo counter that punches and celebrates milestones, and a brighter tick.
There is deliberately no screen shake or hit-stop on the note field: both hurt
readability on a precision field and desync the read, so the juice decorates the
field without ever moving the notes. Reduced motion trims the cosmetic layer and
keeps the essential feedback.
