# 7. Cap pasted blogs at 4 slides; one central image excluding the CTA

## Status

Accepted

## Context

Two related content decisions emerged from real use:

1. **Slide count.** A long article could expand into many content slides of diminishing quality.
   Instagram carousels are most effective when tight, and the brand wants a consistent, scannable
   shape rather than a variable wall of slides.
2. **Imagery.** The earlier design attached a photo per slide, which was tedious and produced
   visually inconsistent decks. The CTA/outro is a deliberate solid "marker-box" layout that an
   image would muddy.

## Decision

- Cap a pasted blog at **exactly 4 slides**: cover + 2 content points + outro/CTA. This is
  enforced **structurally** in `buildSlides` (a fixed `POINTS = 2`), not via a user setting.
- Apply **one central image** (a single sidebar upload) to **every generated slide except the
  CTA**. The exclusion is enforced in `App.tsx`'s `slides` memo (`s.kind === "outro"` keeps no
  image).

## Consequences

- **Positive:** Consistent, opinionated deck shape; far simpler UI (one upload vs. per-slide).
- **Positive:** The CTA keeps its intended clean marker-box look regardless of uploads.
- **Negative:** No way to produce a longer deck from a pasted blog without a code change; the old
  `maxPoints` control was removed.
- **Negative:** One image for all slides is less expressive than per-slide art.
- **Note:** JSON-imported decks (`slideJson.ts`) are *not* subject to the 4-slide cap — they
  produce `1 cover + N slides + 1 CTA` as authored.
