# Architecture

The whole system is two layers with one rule between them.

1. **Packages** (`packages/*`): four framework-agnostic, private (unpublished)
   packages that hold all the game logic and rendering.
2. **App** (`apps/web`): a thin Vue 3 layer of views, composables, and stores over
   those packages, which also packages as an Electron desktop app from the same
   renderer.

**The rule:** packages never touch Vue and never import the app. The browser globals
some of them legitimately need (canvas, audio, storage) are confined to those
packages. Nothing under `packages/` imports `apps/web`. This is what lets the same
engine run in a browser tab, an Electron window, and a Node test.

## The packages

Four self-contained packages (none imports another; the app wires them together).
Each keeps its members as files under `src/` behind a barrel `index.js`.

- **chart** the audio-to-chart domain, pure logic: `dsp` (FFT, windows, onset math),
  `analysis` (onset and tempo detection), `charter` (generate step charts, plus
  `createTiming`, the beat-to-second map), `pipeline` (the engine router; its
  `generate` is exported as `generateFromAudio`), `simfile` (read and write
  StepMania `.sm`/`.ssc` with the full tempo map), `radar` (the groove radar), and
  `stems` (optional WebGPU drum isolation).
- **render** canvas and SVG drawing: `noteskin` (the one arrow silhouette and its
  coloring), `notefield` (the scrolling play field, where the game feel lives), and
  `editor` (the chart editor canvas).
- **play** the runtime primitives: `engine` (the Web Audio clock and sounds),
  `input` (keyboard and gamepad to lane events), and `judge` (timing, scoring,
  combo, life, holds; pure).
- **library** the IndexedDB or filesystem song store, with `.ddr` backup.

The design system is a real Vite stylesheet in the app (`styles/design.css` plus
`styles/tokens.js`), and settings and the event bus are small app modules
(`game/settings.js`, `game/bus.js`), not packages.

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

- **Web:** a static single-page app with state-driven screens and no router, so it
  deploys to any static host with no server rewrites.
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
