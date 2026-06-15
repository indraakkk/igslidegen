# 3. React + Vite + TypeScript, no extra libraries

## Status

Accepted

## Context

We needed a UI framework, a build tool, and a language for a small single-screen app whose
real complexity lives in the canvas renderer, not in the UI. Options ranged from a no-framework
vanilla setup to a full meta-framework (Next.js) with state management, styling, and testing
libraries.

The UI is one screen: an input panel and a live preview. State is small (input string, parsed
slides, theme, ratio, active index, one image). There is no routing, no data layer, no SSR need
(see ADR-0001).

## Decision

Use **React 18** for the view, **Vite 5** (`@vitejs/plugin-react`) for dev/build, and
**TypeScript 5 (strict)** for safety. Deliberately omit a state-management library, a CSS
framework, a routing library, and a test runner. State is plain React hooks in `App.tsx`;
styles are hand-written CSS; the only runtime dependency beyond React is JSZip.

## Consequences

- **Positive:** Minimal surface area and dependency count; fast HMR and builds; `tsc -b` in the
  build catches type errors `dev` tolerates.
- **Positive:** No store/boilerplate — state flow is readable top-to-bottom in `App.tsx`.
- **Negative:** No tests yet; correctness of the renderer is verified by eye and `npm run build`.
- **Negative:** Hooks-only state would strain if the app grew (multi-screen, persistence); that
  would warrant revisiting this decision.
- **Negative:** Hand-written CSS means no design-system primitives.
