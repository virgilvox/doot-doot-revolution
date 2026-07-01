# Doot Doot Revolution

A browser rhythm game in the DDR and StepMania tradition. Load a song, analyze
its tempo and onsets, generate step charts at several difficulties, review and
edit the result, and play it on keyboard or dance pad. It ships as one self
contained HTML file, but the source is a workspace of small reusable libraries
plus a thin app that composes them.

Everything runs client side. There is no server, no account, no telemetry.

## Try it

```
npm install
npm run build      # writes apps/ddr/dist/index.html
```

Open `apps/ddr/dist/index.html` in a browser, or serve the folder and visit it.
During development you can also open `apps/ddr/src/index.html`, which loads the
same code as ES modules with no build step.

## How it plays

Pick a track on the Play screen, choose a difficulty on the hero pills, and hit
DANCE. Arrows scroll up to the receptors; hit each on the beat with the arrow
keys or a bound gamepad. Timing windows follow modern StepMania: Marvelous within
22.5ms, Perfect 45ms, Great 90ms, Good 135ms, Boo 180ms. Scroll speed is XMOD, so
a 2.4 multiplier travels 2.4 note-heights per beat. Set a latency offset in
Settings, with a tap calibration to find it.

## Charting engines

Only engines with a working in-browser method exist:

- Quick. On-device onset and tempo. Fast.
- Drum-Aware. Per-band spectral flux biases lane choice, low energy toward Down
  and high toward Up. The default.
- Stem-Split. Isolates the drum stem over WebGPU, then charts the drums. When
  WebGPU is unavailable it falls back to Drum-Aware on the full mix, and the
  review step reports which path ran.

There is no neural step-author engine. No in-browser step-placement model can be
loaded and run, so shipping one would be dishonest. If a real, loadable model
appears, it can be added behind the same interface with a name that describes
what it does.

## Add a Song

Upload a local audio file, pick an engine and difficulties, and generate. The
flow ends in a compact review and edit step that fits inside the console frame.
Scrub through the chart, hear it against the arrows, and fix the mapping (add,
remove, move, and hold), then save the edited charts to your library. Charts
export to a StepMania `.sm` file and round trip through the native package.

## Repository layout

```
packages/        the libraries, published under @doot-games
  core dsp analysis charter pipeline stems simfile
  engine input judge noteskin notefield radar editor library ui
apps/ddr/        the thin app: screens and wiring only
tools/           the single file bundler and the validation checks
```

Logic packages depend only on other logic packages and on `dsp`. Rendering
packages depend on `noteskin`. The editor depends on rendering. The app depends
on everything. No package depends on the app. Each package has its own README
describing its public interface.

## Commands

```
npm test            # unit tests across the logic packages
npm run build       # bundle to apps/ddr/dist/index.html (runs a syntax check)
npm run check       # re-run node --check on the bundled script
npm run render-check # confirm every screen and key element is in the build
npm run validate    # test, build, and render-check together
```

## Contributing

Read `RULES.md`. The rules there are binding for code, docs, UI copy, and commit
messages. In short: client side first, real methods only, small libraries and a
thin app, keep interfaces documented, and validate the build before calling a
change done.

## License

MIT. See `LICENSE`.
