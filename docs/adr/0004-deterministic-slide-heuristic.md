# 4. Deterministic heuristic for slide generation (no AI)

## Status

Accepted

## Context

Article text must be reduced to a handful of slide-sized pieces (a cover, a few content points,
an outro). The obvious modern approach is an LLM summariser. But an LLM means an API key, a
backend or third-party call, per-use cost, latency, non-determinism, and content leaving the
browser — all in tension with ADR-0001 (client-side, private, free).

The brand also wants predictable, repeatable output: the same article should yield the same
slides.

## Decision

Generate slides with a transparent, deterministic heuristic (`slides.ts`): split into sentences,
score them (numbers/stats, punchy length, lede position; penalise attribution noise), pick the
top-scoring sentences in document order, and shape headlines by taking the first clause. Titles
are clamped to a readable ~60 chars without cutting words (`clampTitle`).

## Consequences

- **Positive:** Fully offline, free, instant, and deterministic. No keys, no backend, no data
  egress. Logic is auditable and tweakable.
- **Positive:** Plays directly into auto-generate-on-paste (ADR-0008) since it's synchronous.
- **Negative:** Lower-quality summarisation than an LLM — picks/condenses existing sentences
  rather than writing prose; quality depends on the source's sentence structure.
- **Negative:** Heuristic weights are hand-tuned and somewhat domain-biased (finance/data
  signal words).
- **Future option:** A pluggable "smart" generator could be added behind the same `Slide[]`
  interface without disturbing the rest of the app.
