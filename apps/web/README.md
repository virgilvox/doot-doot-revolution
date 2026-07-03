# @doot-games/web

Doot Doot Revolution as a Vue 3 app, also packaged for the desktop with Electron.
The whole game (Title, Song Select, the controller-driven difficulty modal,
gameplay, Results, Add with the embedded editor, Library, Settings, Controls) is a
component-based single-page app that reuses the framework-agnostic `@doot-games`
packages for all logic and rendering.

## Run

```
npm install            # from the repo root (workspaces)
npm run dev            # web dev server at http://localhost:4318
npm run build          # static web build in dist/
npm run preview        # serve the build
```

## Desktop (Electron)

```
npm run dev:desktop    # Vite plus an Electron window (ELECTRON=1 vite)
npm run build:desktop  # web build, then electron-builder installers in release/
```

The desktop build serves the SPA from a registered `app://` secure scheme, so
IndexedDB and cross-origin isolation work (they do not under `file://`). Electron
unlocks capabilities the browser blocks: URL audio import past the CORS wall
(`net.fetch` in the main process), native open/save dialogs, and filesystem
access, all exposed through a `contextBridge` preload as `window.doot` with the
secure defaults left on. Cross-OS installers need a CI matrix (a dmg needs macOS).

## Architecture

- `src/game/singletons.js` creates the shared bus, settings, engine, input, and
  library once. Composables and Pinia stores wrap them; components never touch
  them directly.
- Composables are the seam to the imperative packages: `useInput` (raw lanes to
  `move`/`confirm`/`cancel` plus `lane:down`/`lane:up`), `useNavigation` (a focus
  scope stack for controller-first menus and modal focus trapping), `useSession`
  (one play, with the abort-epoch guard), `useChart`, `usePlatform`.
- Canvas packages are wrapped: `NoteField.vue` over `@doot-games/notefield`,
  `ChartEditor.vue` over `@doot-games/editor`, `GrooveRadar.vue` over
  `@doot-games/radar`.
- Router is hash history, so one build runs as a static site and inside Electron.

## Controls

Everything is reachable without a mouse. Arrow keys or a gamepad move focus, Enter
or the first face button confirms, Escape or the second cancels. On Select, Up and
Down move the wheel and Right moves onto the top nav, so a controller can reach
Add, Library, Settings, and Pads. Every menu screen has a visible focus ring
(`useRovingFocus`). Selecting a song opens the difficulty modal, navigated the same
way. In gameplay the four arrows are the lanes, and a clean hit pops its receptor
with a glow scaled by the judgment (`@doot-games/notefield` `hit()`).
