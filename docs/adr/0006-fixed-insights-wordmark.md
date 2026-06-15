# 6. The wordmark is a fixed "insights" constant

## Status

Accepted

## Context

Early versions exposed an editable brand/handle field and even allowed a per-slide `brand`
override sourced from the deck JSON or the article. In practice the app serves a single brand,
"insights", and brand text leaking in from arbitrary input (pasted articles, imported JSON) is a
correctness and consistency risk — a stray "brand" value could overwrite the wordmark.

## Decision

Make the wordmark a fixed module constant: `BRAND = "insights"` in `render.ts`, returned by
`brandText()` regardless of any slide or handle argument. Remove the brand/handle UI field and
stop sourcing the wordmark from JSON, pasted text, or the article.

## Consequences

- **Positive:** Every slide is guaranteed on-brand; no input can alter the wordmark.
- **Positive:** Less UI and state to maintain; the `handle` plumbing became dead and was dropped.
- **Negative:** The app is single-brand by construction — supporting another brand now requires a
  code change (or a new ADR reintroducing a configurable brand).
- **Note:** The `brand`/`handle` parameters still exist in some type signatures for now but are
  ignored; they are candidates for cleanup.
