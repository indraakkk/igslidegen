import { useEffect, useRef } from "react";
import { drawSlide, ensureFonts, preloadImage, type AspectRatio, type Theme } from "../lib/render";
import type { Slide } from "../lib/slides";

interface Props {
  slide: Slide;
  theme: Theme;
  ratio: AspectRatio;
  total: number;
  position: number;
  handle?: string;
  /** CSS width of the rendered preview in px. */
  displayWidth?: number;
}

/**
 * Renders a slide to a canvas for on-screen preview. We draw at full IG
 * resolution (scale via devicePixelRatio) and let CSS scale it down, so the
 * preview is pixel-identical to the exported PNG.
 */
export default function SlidePreview({
  slide,
  theme,
  ratio,
  total,
  position,
  handle,
  displayWidth = 320,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const paint = () => {
      if (!cancelled && ref.current) {
        drawSlide(ref.current, { slide, theme, ratio, total, position, handle, scale: dpr });
      }
    };
    paint(); // immediate draw (fallback font / cached image)
    // Repaint once fonts + this slide's image are ready, for pixel parity.
    const ready: Promise<unknown>[] = [ensureFonts()];
    if (slide.imageSrc) ready.push(preloadImage(slide.imageSrc));
    Promise.all(ready).then(paint);
    return () => {
      cancelled = true;
    };
  }, [slide, theme, ratio, total, position, handle]);

  const aspect = ratio === "1:1" ? 1 : 4 / 5;
  return (
    <canvas
      ref={ref}
      style={{
        width: displayWidth,
        height: displayWidth / aspect,
        borderRadius: 18,
        display: "block",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
      }}
    />
  );
}
