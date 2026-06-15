# 9. Offer Portrait 4:5 (default) and Square 1:1 only

## Status

Accepted

## Context

An earlier build offered a 9:16 (Story/Reel) size alongside square. For an Instagram **carousel
feed post**, 9:16 is not a valid feed ratio — the feed supports up to 4:5 portrait and 1:1
square. Portrait 4:5 occupies the most vertical feed space ("stops the scroll"); 1:1 is the
classic symmetric option.

The renderer's layout math is proportional to canvas width and branches on `h > w` (portrait)
vs. the square case, so the two ratios share one code path with minor adjustments.

## Decision

Offer exactly two export sizes:

- **Portrait 4:5 — 1080×1350 — default/recommended.**
- **Square 1:1 — 1080×1080.**

Remove 9:16. Make Portrait the default. The shorter square canvas gets compact adjustments
(smaller image regions, tighter spacing, height-aware body line budgets) so text never overflows.

## Consequences

- **Positive:** Both options are valid carousel ratios; the default maximises feed real estate.
- **Positive:** Two ratios keep layout testing/maintenance bounded.
- **Negative:** No Story/Reel (9:16) export — out of scope for the carousel use case.
- **Negative:** The square format is height-constrained; layouts must keep adapting (image size,
  line budgets) to avoid clipping — an ongoing maintenance cost.
