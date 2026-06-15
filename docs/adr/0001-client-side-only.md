# 1. 100% client-side, no backend

## Status

Accepted

## Context

The product turns an article into Instagram carousel PNGs for a single brand operator.
We needed to decide whether to run any server-side component (for fetching, rendering,
storage, or auth). A backend implies hosting cost, deployment/ops, an attack surface, and
handling of user-supplied content (article text, images) on someone else's machine.

The workload — parse text, lay out slides, rasterise to PNG — can all happen in a modern
browser. There is no multi-user, persistence, or collaboration requirement.

## Decision

Build the entire application as a static client-side bundle. All parsing, layout, rendering,
and packaging (ZIP) run in the browser tab. The only network egress is an optional CORS
proxy call to fetch an article by URL (see ADR-0005) and the Google Fonts CDN.

## Consequences

- **Positive:** Zero server cost and ops; deploy as static files anywhere (CDN/Pages).
  Images never leave the browser — strong privacy story. No auth, database, or secrets.
- **Positive:** Trivially offline-capable for the paste/JSON path.
- **Negative:** No persistence — refreshing loses state; no cross-device history.
- **Negative:** URL fetching is constrained by browser CORS (mitigated, not solved, by the
  proxy in ADR-0005).
- **Negative:** Heavy work (large images, many slides) runs on the user's device.
