# Handoff

State of Doot Doot Revolution and how to pick it up. Read `README.md`,
`CLAUDE.md`, and `RULES.md` first; this file is the working orientation.

## What it is now

A DDR/StepMania-style rhythm game as a Vue 3 + Vite single-page app that also
packages as an Electron desktop app. All game logic and rendering live in four
framework-agnostic, private (unpublished) `@doot-games/*` packages: `chart`,
`render`, `play`, and `library`. The Vue app in `apps/web`
is a thin layer of views,
composables, and stores over those packages. There is no landing page: the app
opens on the Title attract screen.

The earlier vanilla single-file app (`apps/ddr`) was retired; the packages remain
the proof the logic is framework-free.

Current status: builds clean, 102 tests pass (86 package, 16 Vue), deployed live at
https://dance.doot.games (current release v2.2.1) with full SEO (meta, Open Graph,
Twitter cards, JSON-LD, an OG share image, sitemap, and web manifest), signed and
notarized desktop installers published to GitHub Releases, and a working in-app
auto-updater. Verified end to end in the browser (controller-only play, difficulty
modal, viewport-fit gameplay with the game-feel pass, StepMania import, add/review/save,
all menus, a bellows song preview on the select wheel, hand-composed built-in songs, and
the Endless mode). Navigation is state-driven (no router). No console errors. CI is green
(it installs with `npm install` after clearing the lockfile, working around npm/cli#4828).

## Music: composed songs, the bellows engine, and Endless

The audio engine is bellowsjs (a browser-native AudioWorklet synth/DSP library, an npm
dependency of `apps/web`). Everything plays live from code through it: no pre-render, no
loading pause.

Built-in songs are hand-composed, not generative. `packages/chart/src/songs.data.js`
holds ten authored tracks (a real key and tempo, an ordered intro/verse/chorus/bridge/
outro form with intentional chord progressions and written melodies/basslines in a
compact note notation, with reused hooks). `packages/chart/src/songbook.js`
`compileSong` turns a song into a PIECE (the same shape `composePiece` produces and
`chartFromPiece` consumes), filling the accompaniment the author does not spell out
(nearest-motion pad voicings, a genre bass groove, a chord-tone arp, and a danceable
four-on-the-floor kit) on the 16-step grid so it serves the written parts. These are
originals, so they carry no artist. The generative `composePiece` (functional-harmony
Markov, Euclidean rhythms, chord-tone Markov lead) is now used only by Endless.

`apps/web/src/game/bellowsConductor.js` plays a PIECE live: it boots one Bellows on the
engine's shared AudioContext, routes it through the engine music bus (so volume and
fades apply), builds a genre voice rack (`game/bellowsRacks.js` maps the composer's nine
voices to bellows engines + fx per genre, e.g. synthwave/house/breakcore/chiptune), and
schedules the piece via `b.clock.at('16n', ...)`. The engine adopts bellows' transport
start as the song clock (`engine.adoptClock`) so the judge and renderer read one clock.
Reverb and delay are shared session buses created once (the kernel has no removeBus);
racks report their channel ids and `stopLive` removes them, so dead channels do not
accumulate and starve the worklet (that leak caused audio dropouts). The wheel preview
uses the same rack (`previewPieceLive`) so a song sounds the same before and after you
pick it.

`chartFromPiece` (pure, Node-tested) maps the PIECE events to a step chart per
difficulty. It gates density by subdivision COVERAGE, not a notes-per-second cap:
`DIFFS` carries `eighth` and `sixteenth` fractions, so Beginner is quarters, Basic
quarters plus half the eighths, Difficult full eighths, Expert full eighths plus
sixteenth bursts (kept as runs, not gallops), and Challenge full sixteenth streams. This
is tempo-independent, unlike the old nps cap, which at ~160 bpm silently dropped every
sixteenth and collapsed Expert onto Difficult (why Expert used to feel under-Expert);
Expert now runs ~640 notes with real sixteenth bursts at any tempo, Challenge clearly
above it with roughly double the jumps. Lane selection is the shared `pickPanel` (home-
side bias, controlled crossover and footswitch) so composed and audio charts feel the
same. `maxNps` still caps the audio charter, where noisy onsets make peak spacing the
right tool. A
`leadIn` (~2.2s) holds the first arrow so nothing is unmissable on the receptor at t=0.
Each note carries the musical pitch of the arrow, so the optional hit sounds (off by
default, a Settings toggle) play the song's own notes instead of one beep. The groove
radar is measured from the notes (stream=density, voltage=peak 2s density, air=jumps,
freeze=holds, chaos=off-quarter syncopation) so every axis varies per song.

The `∞ Endless` tile (renamed from Perpetual) launches an endless, evolving stream. The
conductor (`game/conductor.js`) grows one generative piece in place and charts it ahead;
`playEndlessLive` plays that growing piece live through a bellows rack, and old events/
notes prune behind the playhead so any run stays bounded. Its wheel card glows and
sparkles at all times and sweeps a sheen when selected, and it previews a short
generative piece.

There is still an optional generative shader background (ported from the spline engine
into `@doot-games/render` `background.js`) behind the notefield in `GameView`, keyed to
the song's mood, with a `settings.background` toggle. The old subtractive synth
(`@doot-games/play` `synth.js`, `engine.playPiece`) remains in the engine but is no
longer the built-in playback path.

Gameplay has an optional generative shader background (ported from the spline engine
into `@doot-games/render` `background.js`): a seeded grammar bakes a GLSL fragment
shader once and evolves it via animated uniforms, the same generative concept as the
music. `ShaderBackground.vue` runs it behind the notefield in `GameView` with the
look derived from the song's mood; the lanes darken (`NoteField` `laneBg`) so arrows
stay readable over it, and a `settings.background` toggle turns it off.

The `∞ Perpetual` tile in the song wheel launches an endless, evolving stream. A
conductor (`game/conductor.js`) grows one piece in place: each phrase is composed
(re-rolling melodies against a fixed key/tempo/mood, ferrule's evolve) and appended to
the piece the live scheduler is playing, while its chart notes append to the growing
chart and Judge in lockstep; old events/notes prune behind the playhead so any run
stays bounded. The engine scheduler gained a `source.extend()` hook, the Judge gained
`appendNotes`/`pruneBefore` and a monotonic endless score, and `useSession.startEndless`
runs the normal loop with no end and quit-to-summary. No buffers, no seams.

## VRM dancer (optional)

An optional VRM character dances over the gameplay shader, cycling moves and cutting
camera shots, in the SWIVEL mockup's style. The engine is a new subpath export
`@doot-games/render/avatar` (three 0.164.1 + `@pixiv/three-vrm` 3.5.4 +
`three-vrm-animation` 3.5.4), kept out of the render barrel so `three` is not in the
base bundle: `ShaderBackground.vue`'s sibling `DancerStage.vue` dynamic-imports it, so
it rides a lazy chunk loaded only when the Dancer setting is on (verified: the entry
chunk has zero three/VRM code; the split chunk carries it). It draws to a transparent
canvas layered over `ShaderBackground` and under the notefield in `GameView`.

The avatar is always in a real dance clip, never a static or default pose. On mount it is
kept hidden until a clip is actually driving it, then revealed straight into that clip
(the first clip snaps to full weight), so the model's bind/default pose is never shown.
The stage loops one full-body mocap clip and cross-fades to a fresh one every 7-12
seconds: the pixiv `VRMA_0x` motions and the two Mixamo `.fbx` dances (retargeted at
runtime by `avatar/fbxRetarget.js`, the verified pixiv method, with the parsed FBX cached
per URL so an avatar swap only re-runs the retarget). The procedural swivel rig
(`avatar/moves.js`, ported and smoothed from the mockup; tiered by combo via
`avatar/director.js`) is only a fallback while clips load or if none are bundled;
`avatar/retarget.js` `applyVRMPose(bones, pose, weight)` slerps it over whatever the clip
mixer wrote so the handoff never pops. `avatar/camera.js` cuts nine framings (side thirds
plus centered close/hero shots behind the lane band), each an eased smootherstep push
rather than a hard jump, with longer shots so it never feels busy. The contact shadow
tracks the avatar's hips world position, so it follows a clip that translates (the slide
dance). The pure pieces are Node-tested (`packages/render/test/avatar.test.js`); the
stage is verified in-browser.

Assets are bundled in `apps/web/public/{vrm,vrma,fbx}` and fetched by URL on demand
(manifest `game/avatars.js`). Only one VRM is resident. The default is the `7536…` model;
on web one avatar is picked at random from a small pool (`WEB_POOL`) per session for
variety, on desktop from the full roster, and an explicit Settings choice overrides the
pick. On desktop every dance clip preloads; on web a light subset preloads
(`WEB_PRELOAD`). The stage reads a non-reactive `game/dancerClock.js` (beat + combo)
written once per `useSession` loop, so the avatar never triggers a Vue re-render, and it
re-seeds its schedulers when the beat rewinds so a song restart never freezes it. Guards:
the canvas is `pointer-events:none`, the rAF pauses when the tab is hidden, reduced motion
calms the camera and amplitude, `pixelRatio` is capped, and the VRM is `deepDispose`d on
unmount or swap. Settings has a Dancer toggle (on by default) and a "Dancer model"
picker; dropping a `.vrm`/`.vrma`/`.fbx` on the game stage swaps the avatar or adds a
dance.

## Run, build, test

```
npm install            # workspaces
npm run dev            # web dev server (Vite, default http://localhost:5173)
npm run build          # web build (apps/web/dist)
npm run dev:desktop    # Vite inside an Electron window
npm run build:desktop  # electron-builder installers (needs a desktop OS; dmg needs macOS)
npm test               # 80 package unit tests (node --test)
npm run test:web       # 12 Vue component/nav/settings/preview tests (Vitest)
npm run test:all       # both
```

## Layout

```
packages/    chart (dsp analysis charter pipeline simfile radar stems)
             render (noteskin notefield editor)  play (engine input judge)  library
             (private, not published; members are files behind a barrel index.js)
apps/web/    Vue 3 app; electron/ is the desktop target; electron-builder.yml
tools/       shared test helpers (testutil.mjs, fakecanvas.mjs)
```

## App architecture (apps/web)

- `src/game/singletons.js` creates the shared engine, input, and library once.
  Nothing else instantiates them. The event bus is `game/bus.js`, and settings is
  `game/settings.js`, one reactive object (Vue `reactive` + `watch`) that the render
  loop reads directly and the UI binds to, with persistence and side effects as
  watchers. The design system is a real stylesheet (`styles/design.css`) plus
  `styles/tokens.js` for the values JS needs.
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
- Pinia stores: `library`, `songs` (settings is the reactive module above, not a store).
- Canvas members of `render` are wrapped: `NoteField.vue`, `ChartEditor.vue`, `GrooveRadar.vue`.
- No router: screens are swapped by state (`game/screen.js`, read `screen`, call
  `go`), so there are no route URLs, browser Back never interrupts a song, and one
  build runs as a static site and inside Electron with nothing to keep in sync.

## Controller-first navigation

The whole app is operable with no mouse. On Select, Up/Down move the wheel, Right
moves onto the top nav (shared `game/navFocus.js` signal) so Add, Library,
Settings, and Pads are reachable, and confirm dances or opens the nav target. Every
menu screen shows a focus ring. Gameplay maps the four arrows to the lanes.

The nav bus (`useInput` to `useNavigation`, a scope stack where only the top scope gets
input) is the only focus authority; the browser's own DOM focus is not used. So the
input handler (`@doot-games/play` `input.js`) `preventDefault`s confirm and back
(Enter/Escape) as well as the lane keys: otherwise Enter would also fire the default
click on whatever button the browser still had focused (a nav tab you clicked), which
made a confirm exit a modal or navigate instead. The text-field guard runs first, so
Enter to submit a URL still works. `screen.js` `go()` also blurs the active element on
every navigation so a clicked tab does not keep a stray focus ring.

## Electron

Web-first via `vite-plugin-electron` (electron 31, electron-builder 24). `main.js`
keeps the secure defaults on, serves the packaged SPA from a registered `app://`
secure scheme (so IndexedDB and cross-origin isolation work, unlike `file://`),
sets COOP/COEP headers, restricts navigation and window-open, and exposes desktop
capabilities over IPC: CORS-free audio fetch (http(s) only), native dialogs, and
filesystem access (path-contained). `preload.js` bridges them as `window.doot`.

The packaged app self-updates with electron-updater (a runtime dependency,
externalized from the electron bundle like youtube-dl-exec). `setupUpdater` checks
GitHub releases on launch and every few hours, downloads a newer build in the
background, and posts status to the renderer over `update:status` (available,
downloading with a percent, ready, or error). The main process also remembers the last
status and serves it over `update:state`, so a view opened after the download finished
still sees it, not only future events. The nav button is adaptive
(`components/DownloadModal.vue`): on web it is Download (opens the release modal); on
desktop the Download button is gone and an Update button appears (pulsing) only when a
newer build is downloaded and ready, and clicking it runs `autoUpdater.quitAndInstall`.
Settings has a "Check for updates" row (desktop) that shows the download percent, and
when ready its label turns from Check now to Update and installs on click. If
auto-update errors, the nav Update button opens the releases page as a manual fallback.

macOS gotcha, since it silently breaks in-app updates: Squirrel.Mac can only apply a
`zip`, not a `dmg`. `electron-builder.yml` must build both mac targets (`dmg` for manual
download, `zip` for the updater); with `dmg` only, `latest-mac.yml` points at the dmg and
the updater hangs in downloading forever and never fires ready. Confirm a release lists
`mac-arm64.zip`/`mac-x64.zip` and that `latest-mac.yml` references the zips. Windows
(NSIS `.exe`) and Linux (AppImage) update fine from their single artifact.

Settings (localStorage under the `app://` origin) and the song library (a user-picked
folder) both live in userData, which the update never touches, so they carry over.
Auto-update ships from v2.1.5 on, and the zip fix from v2.1.7 on; a build older than the
first zip release needs one manual update to a zip build, after which it is automatic.

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

Feedback is a rendering concern, so it lives in `@doot-games/render` (and the
engine for sound), keeping logic pure. A hit stacks channels and scales them by
the judgment (accumulation, not substitution): receptor pop, spark burst,
expanding ring, a judgment word scaled by tier, a combo counter that punches per
increment and celebrates every 50th, and (off by default, a Settings toggle) a hit
sound pitched to the note the arrow plays. A miss gives a restrained red field-tint at
the edges. Receptors pulse to the beat
as a timing anchor. `notefield.setReducedMotion(true)` trims the cosmetic motion
while keeping essential feedback, wired to the reduced-motion setting.

Deliberate omissions, grounded in game-feel research: no screen shake and no
hit-stop on the note field. Both hurt readability on a precision field and desync
the read, so decoration surrounds the field and never moves the notes. This was a
design choice, not an oversight. If a screen-shake option is ever added, gate it
behind a default-low intensity slider and apply it to a background layer only.

Arrow color follows the Dance Dance Revolution "Note" scheme, by beat not by lane:
4th red, 8th blue, 12th green, 16th gold (24th and 32nd kept distinct in
`@doot-games/render`). The notefield draws each note with `colorFor(n.quant)` and
uses the lane only for rotation, so a jump is one color. The per-direction palette
is decoration for menu specimens only. Cycling the song wheel plays a soft
`engine.cursor` blip (SelectView watches `songs.sel`), and the highlighted song
plays a looping, faded preview so the screen is not silent
(`composables/useSongPreview.js`): composed songs preview live through their bellows
rack (`previewPieceLive`), imported ones from a decoded buffer; debounced so scrolling
stays quiet, faded on the music bus, and stopped the moment a song starts or the
screen changes.

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
  electron-builder. The macOS job is signed and notarized (Developer ID cert +
  `APPLE_*` secrets + `mac.notarize`); Windows and Linux publish unsigned. Each job
  fetches a standalone yt-dlp binary first (the npm postinstall hits the API rate
  limit on shared runner IPs). electron-builder uploads to a draft release, and
  GitHub's `/releases/latest` (the in-app Download button and the auto-updater both
  read it) ignores drafts, so a final `publish` job flips the release to published +
  latest once all four platforms have uploaded. macOS entitlements live at
  `apps/web/build/entitlements.mac.plist`. To cut a release: bump the version in
  `package.json` and `apps/web/package.json` (surgical string edit, keep the root
  `workspaces` and `optionalDependencies` intact), commit, tag `vX.Y.Z`, and push the
  tag.
- The web app is LIVE at https://dance.doot.games as a DigitalOcean App Platform
  Static Site (the free tier: no server, no container), app name `dance-doot-games`.
  `doot.games` is a DO-managed zone, so App Platform created the `dance` CNAME and
  the TLS cert automatically. `.do/app.yaml` is the spec; `deploy_on_push: true`
  redeploys `main`. There is no routing, so no rewrites are needed. Build gotcha,
  encoded in the spec: the build runs
  `rm -rf node_modules package-lock.json && npm install --include=dev && npm run build`.
  The committed lockfile is generated on macOS and omits the Linux-only
  `@rollup/rollup-linux-x64-gnu` that Vite needs; both `npm ci` and `npm install`
  honor that tree (npm/cli#4828), so the lockfile is reset to resolve it fresh on
  the Linux builder. A GitHub source link (`components/GithubLink.vue`) sits in the
  nav and the title footer; the Electron window-open handler routes external https
  through `shell.openExternal` so it works in the desktop app too.
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
is now real: `@doot-games/chart` gained `songToSM(record)` and the Library screen
exports any song's charts as one StepMania `.sm`.

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
- The packages are private (unpublished) internal workspace modules, so there is no
  versioning treadmill; the app links them directly and `node --test` runs them.
- Component test coverage is smoke-level. Deeper tests for the roving focus and the
  session loop would help.

## SEO

`apps/web/index.html` carries a descriptive title and meta description, keywords,
canonical, robots, Open Graph and Twitter card tags, and a VideoGame JSON-LD block, plus
a noscript fallback for crawlers that do not run JS. `public/` holds the share assets:
`og.png` (a 1200x630 card with the mascot, title, and DDR arrows, rendered from an SVG
with rsvg-convert), PNG app icons, `manifest.webmanifest`, `robots.txt`, and
`sitemap.xml`. Vite copies `public/` into `dist` and preserves the head tags, so the
static site serves them; the social image is referenced by absolute URL so scrapers
fetch it. Copy is plain with no em dashes, per `RULES.md`.

## Git state

Branch `main`, remote `github.com/virgilvox/doot-doot-revolution`. Fully committed
and pushed; the web app auto-deploys from `main` and desktop releases cut from
`vX.Y.Z` tags. Releases run v2.0.0 through v2.2.1 (current), signed and notarized.
Recent work, newest first: the optional VRM dancer over the gameplay shader (v2.2.0),
which always plays a real dance clip (revealed hidden-until-a-clip-drives, so the static
default/arms-up pose is never shown), cycles the pixiv VRMA and runtime-retargeted Mixamo
FBX dances, and cuts an eased, calmer camera (v2.2.1 smoothed the cuts with a
smootherstep transition and longer shots); the step-chart difficulty rebalance to DDR
conventions (subdivision coverage so Expert keeps sixteenth bursts at every tempo);
clarifying the import time estimate and scrolling to the build progress; reflect a
finished update in Settings (its button turns to
Update, with a download percent); fix macOS auto-update that hung in downloading (build
a zip target Squirrel.Mac can apply); stop Enter and Escape from also triggering a
focused button's default click; full SEO (meta, Open Graph, JSON-LD, OG image, sitemap,
manifest); desktop auto-update + adaptive nav button + release auto-publish; a
channel-leak fix that was causing audio dropouts; dropping the fake artist credits (the
built-ins are originals); an honest groove radar and off-by-default pitched hit sounds;
the chart lead-in, Endless preview, wheel sparkle, and two more composed songs;
hand-composing all ten prebuilt songs (the songbook + compiler); a danceable
four-on-the-floor drum rewrite and Endless on bellows; per-genre bellows voice racks
with live playback; and the bellows audio engine integration itself. Keep the working
tree clean between tasks.

## Packages are private

The four `@doot-games/*` packages are `private: true` internal workspace modules,
not published to npm (nothing outside this app consumes them). The app links them
through the workspace and `node --test` runs their tests. If you ever want to
publish one, drop its `private` flag and add a version.
which is satisfied by a 0.1.x bump.

## Rules reminder

Commits are imperative, no emojis, and carry no AI attribution or co-author trailer
for an assistant. Follow the writing rules in `RULES.md` for all copy and comments.
