/**
 * Turn an extracted Article into an ordered set of Instagram slides.
 *
 * No AI/backend — this is a transparent, deterministic heuristic:
 *   - a cover slide (the headline),
 *   - N "point" slides built from the highest-signal sentences,
 *   - an optional pull-quote slide,
 *   - an outro / call-to-action slide.
 */

import type { Article } from "./extract";

export type SlideKind = "cover" | "point" | "quote" | "outro" | "content";

export interface Slide {
  kind: SlideKind;
  /** Big text. For points this is a short headline-style line. */
  heading?: string;
  /** Supporting body text (cover subtitle, point detail, quote body). */
  body?: string;
  /** Multi-paragraph body (used by JSON-imported slides). Takes priority over `body`. */
  bodies?: string[];
  /** "01" style index badge for point slides. */
  index?: string;
  /** Optional small line shown under the main CTA (e.g. "Follow us"). */
  secondary?: string;
  /** Per-slide brand override (falls back to the global handle). */
  brand?: string;
  source?: string;
  /** Object/data URL of a user-uploaded image used as the slide's photo. */
  imageSrc?: string;
  /** Original descriptive image hint from a JSON deck (caption only). */
  imageHint?: string;
}

export interface SlideOptions {
  /** Max number of content (point) slides. Instagram carousels allow up to 10 total. */
  maxPoints?: number;
}

export function buildSlides(article: Article, _opts: SlideOptions = {}): Slide[] {
  // A pasted blog is capped at 4 slides total: cover + 2 content points + outro.
  const POINTS = 2;
  const source = article.source;

  const sentences = topSentences(article.paragraphs, POINTS);
  const slides: Slide[] = [];

  // Cover
  slides.push({
    kind: "cover",
    heading: article.title,
    body: firstSentence(article.paragraphs),
    source,
  });

  // Up to 2 content points.
  sentences.slice(0, POINTS).forEach((s, i) => {
    slides.push({
      kind: "content",
      index: String(i + 1).padStart(2, "0"),
      heading: toHeadline(s),
      body: s,
      source,
    });
  });

  // Outro / CTA
  slides.push({
    kind: "outro",
    heading: "Save & share",
    body: source ? `Full article on ${source}` : "Follow for more breakdowns",
    source,
  });

  return slides;
}

/* ------------------------------------------------------------------ */
/* sentence scoring                                                    */
/* ------------------------------------------------------------------ */

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 240);
}

/** Pick the N best sentences across the article, keeping document order. */
function topSentences(paragraphs: string[], n: number): string[] {
  const all = paragraphs.flatMap(splitSentences);
  if (all.length === 0) return [];

  const scored = all.map((s, i) => ({ s, i, score: scoreSentence(s, i, all.length) }));
  const chosen = scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s);

  return dedupe(chosen);
}

function scoreSentence(s: string, index: number, total: number): number {
  let score = 0;
  // Numbers / stats are high-signal for finance/data articles.
  if (/\d/.test(s)) score += 3;
  if (/[%$€£]|\b(percent|per cent|yield|rate|cost|price|return)\b/i.test(s)) score += 2;
  // Prefer punchy-but-complete length.
  const len = s.length;
  if (len >= 60 && len <= 160) score += 2;
  // Slight bias toward earlier sentences (lede).
  score += Math.max(0, 2 - (index / Math.max(1, total)) * 2);
  // Penalise hedging / attribution noise.
  if (/\b(said|according to|reuters|bloomberg)\b/i.test(s)) score -= 1;
  return score;
}

/* ------------------------------------------------------------------ */
/* text shaping                                                        */
/* ------------------------------------------------------------------ */

/** Compress a sentence into a short headline (first clause, ~7 words). */
function toHeadline(sentence: string): string {
  const firstClause = sentence.split(/[,;:—–-]/)[0].trim();
  const base = firstClause.length >= 18 ? firstClause : sentence;
  const words = base.split(/\s+/).slice(0, 8).join(" ");
  return capitalize(words.replace(/[.,;:]+$/, ""));
}

function firstSentence(paragraphs: string[]): string | undefined {
  for (const p of paragraphs) {
    const s = splitSentences(p)[0];
    if (s) return s;
  }
  return paragraphs[0];
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
