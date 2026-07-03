# @doot-games/ui

The arcade candy design language: bright, bold, playful, with deep ink outlines,
chunky block shadows, and a warm paper field. Ships the tokens as CSS variables,
the full component stylesheet, and small DOM helpers.

## API

- `css` the complete stylesheet as a string. This is the source of truth for styling. The app injects it into the document at boot.
- `tokens` the palette, spacing scale, radii, fonts, and easing curves as data, so canvas and logic code can read the same values the CSS uses.
- `DIFF_VAR` maps a difficulty key to its `--d-*` CSS variable name.
- `mountCss(doc?, id?)` injects the stylesheet into a document and returns the `<style>` element.
- `mountFonts(doc?)` links the Baloo 2 and Outfit web fonts.

## Tokens

Ink `#22203F` anchors every outline and shadow. The candy colors do the talking:
cherry, blueberry, lime, lemon, grape, bubblegum, tangerine, aqua. Difficulty
coding runs beginner (aqua), basic (lime), difficult (tangerine), expert
(cherry), challenge (grape). Type is Baloo 2 for anything loud and Outfit for
labels and data. Shadows are hard offsets, never blur. Corners are round on
purpose.
