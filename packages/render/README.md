# @doot-games/render

Canvas and SVG drawing, as one private workspace package. Imperative Canvas/DOM; the
Vue app wraps these behind components.

Members, each a file under `src/` re-exported from `index.js`:

- **noteskin** the StepMania arrow silhouette and its DDR quantization coloring,
  drawn to a 2D canvas or returned as an SVG string. One geometry, reused
  everywhere.
- **notefield** the scrolling notefield play surface. XMOD scroll in beat space, so
  BPM changes and stops read correctly. Wrapped by `NoteField.vue`.
- **editor** the embeddable chart review and edit strip (minimap, playhead, undo).
  Wrapped by `ChartEditor.vue`.
- **background** a seeded generative fragment-shader backdrop (ported from the spline
  engine): a grammar assembles a GLSL shader from noise fields, domain warp, IQ
  palettes and post; it bakes once and evolves via animated uniforms. `createBackground(canvas)`
  drives it; the app runs it behind the notefield during play.
