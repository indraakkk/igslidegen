# 8. Auto-generate from pasted text/JSON; the button regenerates

## Status

Accepted

## Context

Originally the user had to click a button to turn input into slides. For the paste and JSON
paths this is friction — generation is synchronous, offline, and cheap (ADR-0004), so requiring
a click adds a step for no benefit. URL fetching is different: it hits a third-party proxy
(ADR-0005) and should not fire on every keystroke.

## Decision

Auto-generate the deck from **pasted text** and **slide JSON** via a **400 ms debounced**
`useEffect` watching the input. URLs are **skipped** by the auto path and require the explicit
button. The primary button therefore acts as **"Fetch & generate"** for URLs and
**"Regenerate"** for text/JSON. Parse errors mid-typing are swallowed so the UI doesn't flash
errors while the user is still pasting.

## Consequences

- **Positive:** Paste → slides with no click; immediate, live feedback. The button becomes an
  intentional re-run, not a required step.
- **Positive:** URL fetches stay explicit, so the CORS proxy isn't spammed while editing.
- **Negative:** The debounce is a tuned constant (400 ms) — too short spams parsing, too long
  feels laggy.
- **Negative:** Two distinct generation paths (effect for text/JSON, handler for URL) must be
  kept behaviourally consistent.
