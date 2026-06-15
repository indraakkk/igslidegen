# Architecture Decision Records

ADRs capture the significant architectural choices behind IG Slides, the context that
forced each choice, and the trade-offs accepted. Each record is immutable once
**Accepted** — to change a decision, add a new ADR that supersedes the old one.

Format: lightweight [MADR](https://adr.github.io/madr/). Status is one of
`Proposed` / `Accepted` / `Superseded by ADR-XXXX`.

| # | Title | Status |
|---|-------|--------|
| [0001](0001-client-side-only.md) | 100% client-side, no backend | Accepted |
| [0002](0002-canvas-rendering.md) | Render slides with the Canvas 2D API | Accepted |
| [0003](0003-react-vite-typescript.md) | React + Vite + TypeScript, no extra libraries | Accepted |
| [0004](0004-deterministic-slide-heuristic.md) | Deterministic heuristic for slide generation (no AI) | Accepted |
| [0005](0005-cors-proxy-with-paste-fallback.md) | Fetch article URLs via a public CORS proxy, paste as fallback | Accepted |
| [0006](0006-fixed-insights-wordmark.md) | The wordmark is a fixed "insights" constant | Accepted |
| [0007](0007-four-slide-cap-and-central-image.md) | Cap pasted blogs at 4 slides; one central image excluding the CTA | Accepted |
| [0008](0008-auto-generate-on-input.md) | Auto-generate from pasted text/JSON; button regenerates | Accepted |
| [0009](0009-aspect-ratios.md) | Offer Portrait 4:5 (default) and Square 1:1 only | Accepted |
