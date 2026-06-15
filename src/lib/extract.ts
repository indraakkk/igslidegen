/**
 * Article extraction — fully client-side.
 *
 * Two inputs are supported:
 *   1. A URL: fetched through a public CORS proxy (no backend of our own),
 *      then parsed with the browser's DOMParser + a lightweight readability heuristic.
 *   2. Raw text or HTML pasted by the user: parsed directly.
 */

export interface Article {
  title: string;
  paragraphs: string[];
  source?: string; // hostname, shown as a small credit on slides
  url?: string;
}

/** Public CORS proxies, tried in order. They only need to return the raw body. */
const CORS_PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://thingproxy.freeboard.io/fetch/${u}`,
];

export function isUrl(value: string): boolean {
  const v = value.trim();
  if (/\s/.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchArticle(url: string): Promise<Article> {
  let lastError: unknown;
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(proxy(url), { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html && html.length > 200) {
        const article = parseHtml(html);
        article.url = url;
        article.source = safeHostname(url);
        if (article.paragraphs.length > 0) return article;
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Could not fetch the article (CORS-blocked or offline). Paste the article text instead. (${String(
      lastError ?? "unknown error"
    )})`
  );
}

/** Build an Article from a pasted blob — auto-detects HTML vs plain text. */
export function parsePasted(input: string): Article {
  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(input) && /<(p|div|h1|h2|article|body)/i.test(input);
  if (looksLikeHtml) return parseHtml(input);

  const blocks = input
    .split(/\n\s*\n+/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const title = blocks.length ? blocks[0] : "Untitled";
  const paragraphs = blocks.length > 1 ? blocks.slice(1) : blocks;
  return { title: clampTitle(title), paragraphs };
}

/* ------------------------------------------------------------------ */
/* HTML parsing + readability heuristic                                */
/* ------------------------------------------------------------------ */

function parseHtml(html: string): Article {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const title = extractTitle(doc);
  const root = pickContentRoot(doc);
  const paragraphs = extractParagraphs(root);

  return { title: clampTitle(title), paragraphs };
}

function extractTitle(doc: Document): string {
  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute("content");
  if (og?.trim()) return og.trim();
  const h1 = doc.querySelector("article h1, h1")?.textContent;
  if (h1?.trim()) return h1.trim();
  const t = doc.querySelector("title")?.textContent;
  if (t?.trim()) return t.trim();
  return "Untitled";
}

/** Pick the densest content container — <article> if present, else the block with the most paragraph text. */
function pickContentRoot(doc: Document): Element {
  const article = doc.querySelector("article");
  if (article && textLength(article) > 400) return article;

  const candidates = Array.from(doc.querySelectorAll("main, section, div"));
  let best: Element = doc.body ?? doc.documentElement;
  let bestScore = textLength(best);
  for (const el of candidates) {
    const pCount = el.querySelectorAll("p").length;
    if (pCount < 2) continue;
    const score = textLength(el) + pCount * 25;
    if (score > bestScore) {
      best = el;
      bestScore = score;
    }
  }
  return best;
}

function extractParagraphs(root: Element): string[] {
  const nodes = Array.from(root.querySelectorAll("p, h2, h3, li, blockquote"));
  const out: string[] = [];
  for (const node of nodes) {
    if (node.closest("nav, footer, header, aside, figure, figcaption")) continue;
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (text.length < 40) continue; // drop boilerplate/short links
    if (/^(share|subscribe|advertisement|read more|sign up)/i.test(text)) continue;
    out.push(text);
  }
  // De-duplicate while preserving order.
  return Array.from(new Set(out));
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function textLength(el: Element): number {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim().length;
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function clampTitle(t: string): string {
  const clean = t.replace(/\s+/g, " ").trim();
  // Strip trailing " | Site Name" or " - Site Name".
  return clean.replace(/\s*[|–-]\s*[^|–-]{1,40}$/, "").trim() || clean;
}
