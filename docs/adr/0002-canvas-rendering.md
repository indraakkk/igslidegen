# 2. Render slides with the Canvas 2D API

## Status

Accepted

## Context

Slides must export as exact-size Instagram PNGs (1080×1350 / 1080×1080) and the on-screen
preview must match the export. Candidate approaches:

1. **DOM + html2canvas / dom-to-image** — style with CSS, screenshot the DOM.
2. **SVG → serialise → rasterise.**
3. **HTML5 Canvas 2D** — draw text/images/shapes directly, export via `toBlob`.

DOM-capture libraries are notorious for subtle mismatches (font metrics, gradients, cropping,
sub-pixel rounding) between what's on screen and what's captured, and they pull in heavy
dependencies. We need deterministic, retina-crisp pixels and pixel-parity between preview and
export.

## Decision

Implement a single pure Canvas 2D renderer (`render.ts`). It draws at the exact IG pixel size;
the preview reuses the *same* function scaled by `devicePixelRatio` and shrunk with CSS. Export
is `canvas.toBlob(...)`.

## Consequences

- **Positive:** Preview is pixel-identical to the export — one code path, no capture step.
- **Positive:** Full control over typography (auto-fit, clamp, ellipsis), `object-fit: cover`
  cropping, and multi-stop gradients. No DOM-capture dependency.
- **Positive:** Deterministic output, independent of the surrounding page CSS.
- **Negative:** All layout is hand-coded math — no CSS flow, flexbox, or text shaping helpers;
  measurements are proportional to canvas width and must be maintained by hand.
- **Negative:** Canvas draws are synchronous, so fonts and images must be preloaded before
  drawing (`ensureFonts()`, `preloadImage()`), adding a load-then-repaint dance.
