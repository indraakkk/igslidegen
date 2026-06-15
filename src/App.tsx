import { useEffect, useMemo, useRef, useState } from "react";
import { fetchArticle, isUrl, parsePasted, type Article } from "./lib/extract";
import { buildSlides, type Slide } from "./lib/slides";
import { looksLikeSlideJson, parseSlideJson } from "./lib/slideJson";
import { THEMES, type AspectRatio, type Theme } from "./lib/render";
import { downloadAllAsZip, downloadSlide } from "./lib/download";
import SlidePreview from "./components/SlidePreview";

const SAMPLE_URL =
  "https://www.insightsdigest.sg/article/yields-are-compressing-faster-than-rents-can-grow-when-singapore-investment-property-stops-making-financial-sense-under-the-new-cost-regime";

export default function App() {
  const [input, setInput] = useState("");
  const [ratio, setRatio] = useState<AspectRatio>("4:5");
  const [theme, setTheme] = useState<Theme>(THEMES[0]);

  const [article, setArticle] = useState<Article | null>(null);
  // Slides supplied directly via a JSON deck (bypasses the article heuristic).
  const [jsonSlides, setJsonSlides] = useState<Slide[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  // One uploaded image, applied to every generated slide. Object URL.
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);

  const slides: Slide[] = useMemo(() => {
    const base = jsonSlides ?? (article ? buildSlides(article) : []);
    // Apply the uploaded image to every slide except the CTA/outro, which keeps
    // its solid marker-box layout regardless of any upload.
    return image
      ? base.map((s) => (s.kind === "outro" ? s : { ...s, imageSrc: image }))
      : base;
  }, [jsonSlides, article, image]);

  // Pasted text / JSON generates slides directly (debounced) — no click needed.
  // URLs are skipped here since they require an explicit network fetch.
  useEffect(() => {
    const value = input.trim();
    if (!value || isUrl(value)) return;
    const id = setTimeout(() => {
      try {
        if (looksLikeSlideJson(value)) {
          setJsonSlides(parseSlideJson(value));
          setArticle(null);
          setActive(0);
          setError(null);
        } else {
          const result = parsePasted(value);
          if (!result.paragraphs.length) return; // keep waiting for more text
          setArticle(result);
          setJsonSlides(null);
          setActive(0);
          setError(null);
        }
      } catch {
        // Ignore parse errors while the user is still typing/pasting.
      }
    }, 400);
    return () => clearTimeout(id);
  }, [input]);

  async function handleGenerate() {
    setError(null);
    const value = input.trim();
    if (!value) {
      setError("Paste a URL, article text, or a slide JSON — or upload a .json file.");
      return;
    }
    setLoading(true);
    try {
      if (looksLikeSlideJson(value)) {
        const deck = parseSlideJson(value);
        setJsonSlides(deck);
        setArticle(null);
        setActive(0);
        return;
      }
      const result = isUrl(value) ? await fetchArticle(value) : parsePasted(value);
      if (!result.paragraphs.length) {
        throw new Error("No readable text found. Try pasting the article body directly.");
      }
      setArticle(result);
      setJsonSlides(null);
      setActive(0);
    } catch (err) {
      setArticle(null);
      setJsonSlides(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setInput(text);
      const deck = parseSlideJson(text);
      setJsonSlides(deck);
      setArticle(null);
      setActive(0);
    } catch (err) {
      setJsonSlides(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Attach (or replace) the single image applied to every slide. */
  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImage((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  }

  function removeImage() {
    setImage((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  }

  const exportCfg = { slides, theme, ratio };

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <span className="logo" aria-hidden>▦</span>
          <div>
            <h1>IG Slides</h1>
            <p>Article → Instagram carousel, 100% in your browser.</p>
          </div>
        </header>

        <label className="field">
          <span>Article URL or pasted text</span>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste a URL like\n${SAMPLE_URL}\n\n…or the full article text\n…or a slide deck JSON ({ "cover", "slides", "cta" }).`}
            rows={7}
          />
        </label>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <button className="link" onClick={() => fileRef.current?.click()} type="button">
            Upload JSON file
          </button>
          <button className="link" onClick={() => setInput(SAMPLE_URL)} type="button">
            Use sample URL
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFile}
            style={{ display: "none" }}
          />
        </div>

        <button className="primary" onClick={handleGenerate} disabled={loading} type="button">
          {loading ? "Fetching…" : isUrl(input.trim()) ? "Fetch & generate" : "Regenerate"}
        </button>

        {error && <p className="error">{error}</p>}

        <div className="divider" />

        <div className="field">
          <span>Aspect ratio</span>
          <div className="seg">
            {(["4:5", "1:1"] as AspectRatio[]).map((r) => (
              <button
                key={r}
                type="button"
                className={ratio === r ? "active" : ""}
                onClick={() => setRatio(r)}
              >
                {r === "4:5" ? "Portrait 4:5" : "Square 1:1"}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Theme</span>
          <div className="themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.name}
                className={theme.id === t.id ? "swatch active" : "swatch"}
                style={{ background: `linear-gradient(135deg, ${t.dark}, ${t.sand})`, color: t.brand }}
                onClick={() => setTheme(t)}
              >
                ●
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span>Image (used on every slide)</span>
          <div className="row" style={{ gap: 8 }}>
            <button className="ghost" type="button" onClick={() => imgRef.current?.click()}>
              {image ? "Replace image" : "Upload image"}
            </button>
            {image && (
              <button className="ghost" type="button" onClick={removeImage}>
                Remove
              </button>
            )}
          </div>
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            style={{ display: "none" }}
          />
        </div>

        {jsonSlides && (
          <p className="hint" style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
            Imported {jsonSlides.length} slides from JSON (cover + {Math.max(0, jsonSlides.length - 2)}{" "}
            slides + CTA).
          </p>
        )}

        {slides.length > 0 && (
          <button
            className="primary export"
            type="button"
            disabled={busy}
            onClick={() => withBusy(() => downloadAllAsZip(exportCfg))}
          >
            {busy ? "Rendering…" : `Download all (${slides.length}) as ZIP`}
          </button>
        )}
      </aside>

      <main className="stage">
        {slides.length === 0 ? (
          <div className="empty">
            <h2>No slides yet</h2>
            <p>Paste article text or a slide JSON on the left — slides generate automatically.</p>
            <p className="hint">
              For a URL, click “Fetch &amp; generate” (uses a public CORS proxy). If a site blocks it,
              copy the article body and paste the text instead — that always works.
            </p>
          </div>
        ) : (
          <>
            <div className="stageMain">
              <SlidePreview
                slide={slides[active]}
                theme={theme}
                ratio={ratio}
                total={slides.length}
                position={active + 1}
                displayWidth={ratio === "1:1" ? 460 : 400}
              />
              <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  className="ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => withBusy(() => downloadSlide(exportCfg, active + 1))}
                >
                  Download this slide (PNG)
                </button>
              </div>
            </div>

            <div className="filmstrip">
              {slides.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={i === active ? "thumb active" : "thumb"}
                  onClick={() => setActive(i)}
                >
                  <SlidePreview
                    slide={s}
                    theme={theme}
                    ratio={ratio}
                    total={slides.length}
                    position={i + 1}
                    displayWidth={ratio === "1:1" ? 110 : 96}
                  />
                  <span className="thumbLabel">{s.kind}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
