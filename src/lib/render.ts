/**
 * Pure <canvas> renderer. Draws a Slide at an exact Instagram pixel size and
 * returns the canvas (for preview) or a PNG blob (for download). No DOM/CSS
 * capture libraries — deterministic pixels, retina-crisp, works fully offline.
 *
 * The visual language follows the "insights" reference deck:
 *   - cover / feature  → full-bleed photo + vertical opacity gradient + big title
 *   - dark-bottom      → deep surface, title + body up top, photo pinned to the foot
 *   - sand-top         → light surface, inset photo on top, title + body below
 *   - cta (outro)      → deep surface, stacked cream "marker" boxes + follow line
 */

import type { Slide } from "./slides";

export type AspectRatio = "4:5" | "1:1";

export interface Dimensions {
  w: number;
  h: number;
}

/** Instagram-recommended export sizes. */
export const SIZES: Record<AspectRatio, Dimensions> = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
};

export interface Theme {
  id: string;
  name: string;
  /** Deep surface (text-heavy dark slides). */
  dark: string;
  /** Deepest surface (CTA background). */
  darkDeep: string;
  /** Light/warm surface (image-top slides). */
  sand: string;
  /** Cream used for the CTA marker boxes. */
  cream: string;
  /** Brand wordmark + accents. */
  brand: string;
  /** Text on the dark surface. */
  onDark: string;
  /** Text on the light surface. */
  onSand: string;
  /** Muted text on dark. */
  mutedOnDark: string;
  /** Muted text on sand. */
  mutedOnSand: string;
}

export const THEMES: Theme[] = [
  {
    id: "insights",
    name: "Insights",
    dark: "#0F3F37",
    darkDeep: "#0C2F2A",
    sand: "#D2CCBC",
    cream: "#EDE7DA",
    brand: "#1F8675",
    onDark: "#F4F1E9",
    onSand: "#0E3B34",
    mutedOnDark: "#CFE0DA",
    mutedOnSand: "#274C44",
  },
  {
    id: "midnight",
    name: "Midnight",
    dark: "#12203A",
    darkDeep: "#0A1526",
    sand: "#E6E2D6",
    cream: "#F1EDE2",
    brand: "#3E8CD8",
    onDark: "#F2F6FD",
    onSand: "#15233B",
    mutedOnDark: "#B9CBE6",
    mutedOnSand: "#33455F",
  },
  {
    id: "plum",
    name: "Plum",
    dark: "#2A1840",
    darkDeep: "#1B0F2C",
    sand: "#E7DEE9",
    cream: "#F2ECF4",
    brand: "#B06CE0",
    onDark: "#F6F1FB",
    onSand: "#2A1840",
    mutedOnDark: "#D2C0E6",
    mutedOnSand: "#4A3563",
  },
];

const FONT_STACK =
  '"Poppins", "Trebuchet MS", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

export interface RenderConfig {
  slide: Slide;
  theme: Theme;
  ratio: AspectRatio;
  total: number;
  position: number; // 1-based index of this slide
  handle?: string; // optional @handle / brand fallback
  scale?: number; // pixel scale (defaults to 1 → exact IG size)
}

/* ------------------------------------------------------------------ */
/* font + image preloading (canvas draws are synchronous)              */
/* ------------------------------------------------------------------ */

let fontsPromise: Promise<void> | null = null;

/** Resolve once the Poppins weights we draw with are ready (no-op offline). */
export function ensureFonts(): Promise<void> {
  if (fontsPromise) return fontsPromise;
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts || typeof fonts.load !== "function") {
    return (fontsPromise = Promise.resolve());
  }
  fontsPromise = Promise.all([
    fonts.load('400 32px "Poppins"'),
    fonts.load('500 32px "Poppins"'),
    fonts.load('600 32px "Poppins"'),
    fonts.load('700 64px "Poppins"'),
    fonts.load('800 90px "Poppins"'),
  ])
    .then(() => undefined)
    .catch(() => undefined);
  return fontsPromise;
}

const imageCache = new Map<string, HTMLImageElement>();

/** Decode an image (object/data URL) into the cache for synchronous drawing. */
export function preloadImage(src: string): Promise<void> {
  const existing = imageCache.get(src);
  if (existing && existing.complete && existing.naturalWidth) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve();
    };
    img.onerror = () => resolve(); // tolerate a broken image — fall back to bg
    img.src = src;
  });
}

/** Preload every image referenced by a set of slides (+ fonts). */
export async function preloadSlideAssets(slides: Slide[]): Promise<void> {
  const srcs = Array.from(new Set(slides.map((s) => s.imageSrc).filter(Boolean) as string[]));
  await Promise.all([ensureFonts(), ...srcs.map(preloadImage)]);
}

function getImage(src?: string): HTMLImageElement | undefined {
  if (!src) return undefined;
  const img = imageCache.get(src);
  return img && img.complete && img.naturalWidth ? img : undefined;
}

/* ------------------------------------------------------------------ */
/* entry points                                                        */
/* ------------------------------------------------------------------ */

export function renderSlide(config: RenderConfig): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  drawSlide(canvas, config);
  return canvas;
}

export function drawSlide(canvas: HTMLCanvasElement, config: RenderConfig): void {
  const { slide, theme, ratio, scale = 1 } = config;
  const { w, h } = SIZES[ratio];

  canvas.width = w * scale;
  canvas.height = h * scale;

  const ctx = canvas.getContext("2d")!;
  ctx.save();
  ctx.scale(scale, scale);
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const pad = Math.round(w * 0.085);
  const handle = config.handle;

  switch (layoutFor(slide)) {
    case "feature":
      drawFeature(ctx, slide, theme, w, h, pad, handle);
      break;
    case "sand-top":
      drawSandTop(ctx, slide, theme, w, h, pad, handle);
      break;
    case "cta":
      drawCta(ctx, slide, theme, w, h, pad, handle);
      break;
    case "dark-bottom":
    default:
      drawDarkBottom(ctx, slide, theme, w, h, pad, handle);
      break;
  }

  ctx.restore();
}

type Layout = "feature" | "dark-bottom" | "sand-top" | "cta";

/**
 * Choose a layout per the reference deck:
 *   - cover (first slide)      → feature (full-bleed photo + opacity gradient + big title)
 *   - outro / cta              → cta
 *   - title-only (no body)     → feature
 *   - body content slides      → alternate sand-top / dark-bottom by index
 */
function layoutFor(slide: Slide): Layout {
  if (slide.kind === "cover") return "feature";
  if (slide.kind === "outro") return "cta";
  const hasBody = bodyParagraphs(slide).length > 0;
  if (!hasBody) return "feature";
  const idx = parseInt(slide.index ?? "1", 10) || 1;
  return idx % 2 === 1 ? "sand-top" : "dark-bottom";
}

/* ------------------------------------------------------------------ */
/* layouts                                                             */
/* ------------------------------------------------------------------ */

/** Full-bleed photo, vertical opacity gradient, brand top-left, big title at the foot. */
function drawFeature(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  theme: Theme,
  w: number,
  h: number,
  pad: number,
  handle?: string
) {
  const img = getImage(slide.imageSrc);
  if (img) {
    drawImageCover(ctx, img, 0, 0, w, h);
  } else {
    // No photo → a deep vertical gradient still reads as a "cover".
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, theme.dark);
    base.addColorStop(1, theme.darkDeep);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
  }

  // Opacity gradient — transparent up top, deepening to near-opaque at the foot
  // so the white title stays legible over any photo.
  const deep = theme.darkDeep;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexToRgba(deep, img ? 0.12 : 0.0));
  grad.addColorStop(0.42, hexToRgba(deep, img ? 0.28 : 0.0));
  grad.addColorStop(0.7, hexToRgba(deep, img ? 0.66 : 0.15));
  grad.addColorStop(1, hexToRgba(deep, img ? 0.95 : 0.65));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  drawWordmark(ctx, brandText(slide, handle), theme.brand, pad, pad * 0.9, w, true);

  // Title anchored to the bottom, growing upward — but never rising past the
  // wordmark (tight in the shorter square format).
  const title = clampTitle(slide.heading);
  const contentW = w - pad * 2;
  const lh = 1.08;
  const wordmarkBottom = pad * 0.9 + w * 0.052 * 1.1 + pad * 0.3;
  const maxByHeight = Math.floor((h - pad * 1.25 - wordmarkBottom) / (Math.round(w * 0.05) * lh));
  const maxLines = Math.min(h > w ? 8 : 6, Math.max(1, maxByHeight));
  const size = fitText(ctx, title, contentW, {
    max: Math.round(w * 0.092),
    min: Math.round(w * 0.05),
    weight: 800,
    maxLines,
  });
  const lines = clampLines(ctx, title, contentW, size, 800, maxLines);
  const blockH = lines.length * size * lh;
  const top = Math.max(wordmarkBottom, h - pad * 1.25 - blockH);
  drawLines(ctx, lines, pad, top, { size, weight: 800, lineHeight: lh, color: theme.onDark });
}

/** Deep surface: brand + title + body up top, photo pinned full-bleed to the foot. */
function drawDarkBottom(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  theme: Theme,
  w: number,
  h: number,
  pad: number,
  handle?: string
) {
  const square = w === h;

  ctx.fillStyle = theme.dark;
  ctx.fillRect(0, 0, w, h);

  const img = getImage(slide.imageSrc);
  const imgH = img ? Math.round(h * (square ? 0.26 : 0.3)) : 0;
  if (img) {
    drawImageCover(ctx, img, 0, h - imgH, w, imgH);
  }

  const contentW = w - pad * 2;
  let y = pad * 0.9;
  y = drawWordmark(ctx, brandText(slide, handle), theme.onDark, pad, y, w, false);
  y += pad * (square ? 0.45 : 0.7);

  const title = clampTitle(slide.heading);
  const titleSize = fitText(ctx, title, contentW, {
    max: Math.round(w * 0.066),
    min: Math.round(w * 0.044),
    weight: 700,
    maxLines: 3,
  });
  y = drawWrapped(ctx, title, pad, y, contentW, {
    size: titleSize,
    weight: 700,
    lineHeight: 1.12,
    color: theme.onDark,
    maxLines: 3,
  });

  const bodies = bodyParagraphs(slide);
  if (bodies.length) {
    const bottomLimit = (img ? h - imgH : h) - pad * 0.9;
    const bodySize = Math.round(w * 0.034);
    const startY = y + pad * (square ? 0.4 : 0.55);
    // Only draw as many body lines as actually fit above the photo — never force
    // a minimum, or the text spills off-canvas / into the image (square format).
    const maxLines = Math.floor((bottomLimit - startY) / (bodySize * 1.4));
    if (maxLines > 0) {
      drawParagraphs(ctx, bodies, pad, startY, contentW, {
        size: bodySize,
        weight: 400,
        lineHeight: 1.4,
        color: theme.mutedOnDark,
        maxLines,
      });
    }
  }
}

/** Light surface: brand, an inset photo up top, then title + body below. */
function drawSandTop(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  theme: Theme,
  w: number,
  h: number,
  pad: number,
  handle?: string
) {
  const square = w === h;

  ctx.fillStyle = theme.sand;
  ctx.fillRect(0, 0, w, h);

  const contentW = w - pad * 2;
  let y = pad * 0.9;
  y = drawWordmark(ctx, brandText(slide, handle), theme.brand, pad, y, w, false);
  y += pad * (square ? 0.45 : 0.7);

  const img = getImage(slide.imageSrc);
  if (img) {
    const imgH = Math.round(h * (square ? 0.26 : 0.34));
    roundRect(ctx, pad, y, contentW, imgH, Math.round(w * 0.012));
    ctx.save();
    ctx.clip();
    drawImageCover(ctx, img, pad, y, contentW, imgH);
    ctx.restore();
    y += imgH + pad * (square ? 0.45 : 0.7);
  }

  const title = clampTitle(slide.heading);
  const titleSize = fitText(ctx, title, contentW, {
    max: Math.round(w * 0.07),
    min: Math.round(w * 0.046),
    weight: 700,
    maxLines: 3,
  });
  y = drawWrapped(ctx, title, pad, y, contentW, {
    size: titleSize,
    weight: 700,
    lineHeight: 1.1,
    color: theme.onSand,
    maxLines: 3,
  });

  const bodies = bodyParagraphs(slide);
  if (bodies.length) {
    const bodySize = Math.round(w * 0.034);
    const startY = y + pad * (square ? 0.4 : 0.55);
    const maxLines = Math.floor((h - pad - startY) / (bodySize * 1.42));
    if (maxLines > 0) {
      drawParagraphs(ctx, bodies, pad, startY, contentW, {
        size: bodySize,
        weight: 400,
        lineHeight: 1.42,
        color: theme.mutedOnSand,
        maxLines,
      });
    }
  }
}

/** Deep surface: stacked cream "marker" boxes (headline + url), follow line + wordmark. */
function drawCta(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  theme: Theme,
  w: number,
  h: number,
  pad: number,
  handle?: string
) {
  const img = getImage(slide.imageSrc);
  if (img) {
    drawImageCover(ctx, img, 0, 0, w, h);
    ctx.fillStyle = hexToRgba(theme.darkDeep, 0.82);
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = theme.darkDeep;
    ctx.fillRect(0, 0, w, h);
  }

  // Stacked cream marker boxes, vertically centred.
  const label = (slide.heading ?? "Read the Full Article").trim();
  const url = (slide.body ?? "").trim();
  const labelSize = Math.round(w * 0.033);
  const urlSize = Math.round(w * 0.062);
  const padX = Math.round(w * 0.022);
  const padY = Math.round(w * 0.014);

  ctx.font = fontStr(labelSize, 600);
  const labelW = ctx.measureText(label).width + padX * 2;
  ctx.font = fontStr(urlSize, 800);
  const urlText = url ? ellipsize(ctx, url, w - pad * 2 - padX * 2) : "";
  const urlW = urlText ? ctx.measureText(urlText).width + padX * 2 : 0;

  const labelBoxH = labelSize + padY * 2;
  const urlBoxH = urlText ? urlSize + padY * 2 : 0;
  const blockH = labelBoxH + (urlText ? urlBoxH - padY * 0.2 : 0);
  let by = Math.round(h * 0.46 - blockH / 2);

  // label box
  ctx.fillStyle = theme.cream;
  roundRect(ctx, pad, by, labelW, labelBoxH, Math.round(w * 0.006));
  ctx.fill();
  ctx.fillStyle = theme.darkDeep;
  ctx.font = fontStr(labelSize, 600);
  ctx.fillText(label, pad + padX, by + padY);
  by += labelBoxH - padY * 0.2;

  // url box (the emphasised line)
  if (urlText) {
    ctx.fillStyle = theme.cream;
    roundRect(ctx, pad, by, urlW, urlBoxH, Math.round(w * 0.006));
    ctx.fill();
    ctx.fillStyle = theme.darkDeep;
    ctx.font = fontStr(urlSize, 800);
    ctx.fillText(urlText, pad + padX, by + padY);
  }

  // Footer: "Follow us" (left) + wordmark (right).
  const footY = h - pad - Math.round(w * 0.045);
  const secondary = (slide.secondary ?? "").trim();
  if (secondary) {
    ctx.fillStyle = theme.onDark;
    ctx.font = fontStr(Math.round(w * 0.044), 500);
    ctx.fillText(secondary, pad, footY);
  }
  const brand = brandText(slide, handle);
  if (brand) {
    ctx.fillStyle = theme.onDark;
    ctx.font = fontStr(Math.round(w * 0.05), 800);
    ctx.textAlign = "right";
    ctx.fillText(brand, w - pad, footY);
    ctx.textAlign = "left";
  }
}

/* ------------------------------------------------------------------ */
/* shared chrome                                                       */
/* ------------------------------------------------------------------ */

/** Draw the brand wordmark; returns the y just below it. */
function drawWordmark(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  x: number,
  y: number,
  w: number,
  shadow: boolean
): number {
  if (!text) return y;
  const size = Math.round(w * 0.052);
  ctx.font = fontStr(size, 800);
  if (shadow) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = size * 0.5;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  if (shadow) ctx.restore();
  return y + size * 1.1;
}

/** Fixed deck wordmark — never sourced from JSON, pasted text, or any input. */
export const BRAND = "insights";

function brandText(_slide?: Slide, _handle?: string): string {
  return BRAND;
}

/* ------------------------------------------------------------------ */
/* image helper                                                        */
/* ------------------------------------------------------------------ */

/** object-fit: cover — fill the box, cropping overflow, centred. */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number
) {
  const ir = img.naturalWidth / img.naturalHeight;
  const dr = dw / dh;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  let sx = 0;
  let sy = 0;
  if (ir > dr) {
    // image wider → crop sides
    sw = img.naturalHeight * dr;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    // image taller → crop top/bottom
    sh = img.naturalWidth / dr;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/* ------------------------------------------------------------------ */
/* text layout primitives                                              */
/* ------------------------------------------------------------------ */

interface WrapStyle {
  size: number;
  weight: number;
  lineHeight: number;
  color: string;
  italic?: boolean;
  maxLines?: number;
}

/**
 * Shorten a headline to a readable ~maxChars line.
 *
 * Headlines are often "Main clause — subtitle" / "Main clause: subtitle". We
 * first take the standalone first clause at a natural break (dash, colon, pipe),
 * which usually already reads as a complete short title. Only if that's still
 * too long do we trim back to the last whole word and add an ellipsis — so a
 * word is never cut mid-way.
 */
function clampTitle(text: string | undefined, maxChars = 60): string {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return t;

  // Prefer the first clause when a natural separator splits off a subtitle.
  const clause = t.split(/\s+[—–:|·]\s+|\s+-\s+/)[0].trim();
  if (clause.length >= 20 && clause.length < t.length) t = clause;

  if (t.length <= maxChars) return t;

  const lastSpace = t.lastIndexOf(" ", maxChars);
  const cut = lastSpace > 0 ? t.slice(0, lastSpace) : t.slice(0, maxChars);
  return cut.replace(/[.,;:!?–—-]+$/, "").trim() + "…";
}

/** Normalise a slide's body into paragraphs (bodies wins over body). */
function bodyParagraphs(slide: Slide): string[] {
  if (slide.bodies && slide.bodies.length) return slide.bodies;
  return slide.body ? [slide.body] : [];
}

/** Stack paragraphs, sharing one line budget so overflow truncates cleanly. */
function drawParagraphs(
  ctx: CanvasRenderingContext2D,
  paragraphs: string[],
  x: number,
  y: number,
  maxWidth: number,
  style: WrapStyle
): number {
  let cursor = y;
  let linesLeft = style.maxLines ?? Infinity;
  const step = style.size * style.lineHeight;
  for (const para of paragraphs) {
    if (linesLeft <= 0) break;
    const bottom = drawWrapped(ctx, para, x, cursor, maxWidth, { ...style, maxLines: linesLeft });
    const used = Math.round((bottom - cursor) / step);
    linesLeft -= used;
    cursor = bottom + step * 0.5; // paragraph gap
  }
  return cursor;
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  style: WrapStyle
): number {
  const lines = clampLines(ctx, text, maxWidth, style.size, style.weight, style.maxLines ?? Infinity, style.italic);
  drawLines(ctx, lines, x, y, style);
  return y + lines.length * style.size * style.lineHeight;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  style: WrapStyle
) {
  ctx.fillStyle = style.color;
  ctx.font = fontStr(style.size, style.weight, style.italic);
  const step = style.size * style.lineHeight;
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * step));
}

/** Wrap to lines at a given size, capping at maxLines with an ellipsis. */
function clampLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: number,
  maxLines: number,
  italic = false
): string[] {
  ctx.font = fontStr(size, weight, italic);
  const lines = wrapLines(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const shown = lines.slice(0, maxLines);
  shown[shown.length - 1] = ellipsize(ctx, shown[shown.length - 1], maxWidth);
  return shown;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (within bounds) that fits text in maxLines. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  o: { max: number; min: number; weight: number; maxLines: number }
): number {
  for (let size = o.max; size >= o.min; size -= 2) {
    ctx.font = fontStr(size, o.weight);
    if (wrapLines(ctx, text, maxWidth).length <= o.maxLines) return size;
  }
  return o.min;
}

function ellipsize(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string {
  let s = line;
  while (s.length > 1 && ctx.measureText(s + "…").width > maxWidth) {
    s = s.slice(0, -1);
  }
  return s.replace(/\s+\S*$/, "") + "…";
}

/* ------------------------------------------------------------------ */
/* misc helpers                                                        */
/* ------------------------------------------------------------------ */

function fontStr(size: number, weight: number, italic = false): string {
  return `${italic ? "italic " : ""}${weight} ${px(size)} ${FONT_STACK}`;
}

function px(n: number): string {
  return `${Math.round(n)}px`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const bigint = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}
