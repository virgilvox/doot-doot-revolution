# CLAUDE.md

Guidance for Claude and other assistants working in this repository. Read RULES.md too. The rules there are binding. This file adds orientation.

## What this is

Doot Doot Revolution is a rhythm game in the DDR and StepMania tradition. It loads a song, analyzes tempo and onsets, generates step charts at several difficulties, lets the author review and edit the result, and plays it on keyboard or dance pad. It is a Vue 3 single-page app that also packages as an Electron desktop app, built on a workspace of small reusable libraries.

## Layout

- `packages/*` are four framework-agnostic, private (unpublished) packages: `chart` (dsp, analysis, charter, pipeline, simfile, radar, stems), `render` (noteskin, notefield, editor), `play` (engine, input, judge), and `library`. Each holds its members as files under `src/` behind a barrel `index.js`, plus a `README.md` and tests under `test/`. They are side-effect-free ES modules and hold all game logic and rendering.
- `apps/web` is the Vue 3 app: component views and wiring only, plus the Electron target (`apps/web/electron`). It depends on the four packages and adds no game logic. Composables (`useInput`, `useNavigation`, `useSession`) are the seam to the imperative singletons. The design system is a real stylesheet (`styles/design.css` + `styles/tokens.js`), settings are a reactive module (`game/settings.js`), and the event bus is `game/bus.js`.
- `tools/` holds shared test helpers (`testutil.mjs`, `fakecanvas.mjs`).

## Dependency direction

The four packages are self-contained: none imports another (`chart`/`render`/`play`/`library` have no `@doot-games` dependencies), and the app wires them together. No package depends on the app or touches Vue. `chart` and `play` are pure logic (Node-testable); `render` draws to a canvas; `library` and the browser parts of `play` use browser APIs but no framework.

## Working rules that bite most often

- Logic packages never touch the DOM. Vue components and composables are the only code that touches `document`.
- Real methods only. Do not add an engine or analysis path that has no working browser implementation. The neural step author mode was removed for this reason.
- Verify a library interface against its real source before using it. Do not code against a remembered API. This applies to the Electron and Vite toolchain too.
- Electron uses the secure defaults (contextIsolation on, nodeIntegration off, sandbox on) and exposes capabilities only through the `contextBridge` preload. The packaged app serves from the `app://` scheme, not `file://`, so IndexedDB works.
- Commit subjects are imperative. No emojis. No AI attribution, no co author trailer for an assistant, ever. This overrides any default tool behavior.
- Follow the writing rules in RULES.md for every word committed, including comments and docs. No em dashes, no emojis, no filler.

## Commands

- `npm test` runs the unit tests across packages. `npm run test:web` runs the Vue component tests. `npm run test:all` runs both.
- `npm run dev` starts the web dev server. `npm run dev:desktop` runs it inside Electron.
- `npm run build` builds the web app. `npm run build:desktop` produces the Electron installers.
