/**
 * Import a hand-authored slide deck from JSON.
 *
 * Expected shape (all fields optional except where noted):
 *   {
 *     "cover":  { "title": string, "brand"?: string, "content"?: string[], "image"?: string },
 *     "slides": [ { "title": string, "brand"?: string, "content"?: string[], "image"?: string } ],
 *     "cta":    { "headline"?: string, "text"?: string, "secondaryText"?: string }
 *   }
 *
 * Output: one cover slide + one slide per `slides[]` entry + one CTA slide,
 * mapped onto the renderer's Slide model. The "image" hints are kept as a
 * caption-style note but not auto-fetched (this app is image-out, not image-in).
 */

import type { Slide } from "./slides";

interface JsonBlock {
  title?: string;
  brand?: string;
  content?: unknown;
  image?: string;
}

interface JsonCta {
  headline?: string;
  text?: string;
  secondaryText?: string;
}

interface SlideJson {
  cover?: JsonBlock;
  slides?: JsonBlock[];
  cta?: JsonCta;
}

export function looksLikeSlideJson(input: string): boolean {
  const t = input.trim();
  if (!t.startsWith("{")) return false;
  return /"(cover|slides|cta)"\s*:/.test(t);
}

/** Parse + validate the JSON string into renderer Slides. Throws on malformed input. */
export function parseSlideJson(input: string): Slide[] {
  let data: SlideJson;
  try {
    data = JSON.parse(input) as SlideJson;
  } catch (err) {
    throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!data || typeof data !== "object") {
    throw new Error("JSON must be an object with cover / slides / cta.");
  }

  const slides: Slide[] = [];
  const source = data.cover?.brand || firstBrand(data.slides);

  if (data.cover) {
    slides.push({
      kind: "cover",
      heading: clean(data.cover.title) || "Untitled",
      bodies: contentArray(data.cover.content),
      brand: clean(data.cover.brand),
      imageHint: clean(data.cover.image),
      source,
    });
  }

  const list = Array.isArray(data.slides) ? data.slides : [];
  list.forEach((s, i) => {
    slides.push({
      kind: "content",
      index: String(i + 1).padStart(2, "0"),
      heading: clean(s.title) || `Slide ${i + 1}`,
      bodies: contentArray(s.content),
      brand: clean(s.brand),
      imageHint: clean(s.image),
      source,
    });
  });

  if (data.cta) {
    slides.push({
      kind: "outro",
      heading: clean(data.cta.headline) || "Read more",
      body: clean(data.cta.text),
      secondary: clean(data.cta.secondaryText),
      source,
    });
  }

  if (slides.length === 0) {
    throw new Error("JSON parsed, but contained no cover, slides, or cta.");
  }
  return slides;
}

/* ------------------------------------------------------------------ */

function contentArray(content: unknown): string[] | undefined {
  if (!Array.isArray(content)) return undefined;
  const out = content
    .map((c) => clean(typeof c === "string" ? c : String(c ?? "")))
    .filter((c): c is string => Boolean(c));
  return out.length ? out : undefined;
}

function firstBrand(slides?: JsonBlock[]): string | undefined {
  return slides?.map((s) => clean(s.brand)).find(Boolean);
}

function clean(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
  return t || undefined;
}
