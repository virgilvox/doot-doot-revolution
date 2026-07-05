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

## Avatar subpath (`@doot-games/render/avatar`)

The VRM dancer is a separate subpath export, **not** part of the barrel above, so
`three` and the `@pixiv/three-vrm` libraries only load when something imports it. The
app dynamic-imports it when the Dancer setting is on, so it rides a lazy chunk and the
base bundle stays free of three.js.

`createDancerStage(canvas, opts)` returns an imperative handle (`start`, `stop`,
`resize`, `setAvatar(url)`, `loadVRMA(url, role)`, `loadFBX(url, role)`, `playEmote`,
`setReducedMotion`, `dispose`). It reads a caller-owned clock `{ beat, combo, playing }`
each frame and runs itself. Internals, split so the motion math is Node-testable
without a canvas:

- **avatar/pose** the pure pose schema, math helpers, and blend.
- **avatar/moves** the tiered procedural dance library (14 moves plus a stumble),
  each `f(beat, pose) -> pose`.
- **avatar/director** picks and cross-fades moves per combo tier.
- **avatar/retarget** copies a pose onto VRM normalized humanoid bones (arm rest
  compensation, spine/head split).
- **avatar/camera** an eight-shot director that cuts and reframes each few bars.
- **avatar/fbxRetarget** retargets a Mixamo `.fbx` onto the VRM humanoid (the
  verified pixiv method), so hip-hop mocap plays through the same mixer as `.vrma`.
- **avatar/stage** the three.js scene, VRM load/dispose, clip mixer, and loop.
