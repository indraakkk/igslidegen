import JSZip from "jszip";
import type { Slide } from "./slides";
import {
  canvasToBlob,
  preloadSlideAssets,
  renderSlide,
  type AspectRatio,
  type Theme,
} from "./render";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ExportConfig {
  slides: Slide[];
  theme: Theme;
  ratio: AspectRatio;
  handle?: string;
}

/** Render one slide at full resolution and return a PNG blob. */
async function renderToBlob(cfg: ExportConfig, position: number): Promise<Blob> {
  const canvas = renderSlide({
    slide: cfg.slides[position - 1],
    theme: cfg.theme,
    ratio: cfg.ratio,
    total: cfg.slides.length,
    position,
    handle: cfg.handle,
    scale: 1,
  });
  return canvasToBlob(canvas);
}

export async function downloadSlide(cfg: ExportConfig, position: number) {
  await preloadSlideAssets(cfg.slides);
  const blob = await renderToBlob(cfg, position);
  downloadBlob(blob, `slide-${String(position).padStart(2, "0")}.png`);
}

export async function downloadAllAsZip(cfg: ExportConfig) {
  await preloadSlideAssets(cfg.slides);
  const zip = new JSZip();
  for (let i = 1; i <= cfg.slides.length; i++) {
    const blob = await renderToBlob(cfg, i);
    zip.file(`slide-${String(i).padStart(2, "0")}.png`, blob);
  }
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(out, `instagram-carousel-${cfg.ratio.replace(":", "x")}.zip`);
}
