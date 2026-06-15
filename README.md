# IG Slides

Turn an article into a downloadable Instagram carousel — **100% client-side**, no backend.
Built with React + Vite + TypeScript; images are drawn with the Canvas API.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build → dist/
npm run preview  # serve the production build locally
```

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Language**   | TypeScript 5.6 (strict) | Compile-time safety; `tsc -b` runs in the build. |
| **UI**         | React 18.3 | Small component tree, hooks-only state (no store needed). |
| **Build/dev**  | Vite 5.4 + `@vitejs/plugin-react` | Instant HMR, ESM, zero-config bundling to `dist/`. |
| **Rendering**  | HTML5 Canvas 2D API | Deterministic, pixel-exact PNGs; preview is the *same* renderer scaled by `devicePixelRatio`. |
| **Fonts**      | Poppins via Google Fonts CDN | Loaded through `document.fonts.load()` so canvas draws wait for glyphs. |
| **Packaging**  | JSZip 3.10 | Bundles all slides into one ZIP, in-browser. |
| **Backend**    | *None* | Everything (fetch proxy aside) runs in the tab; images never leave the browser. |

No state library, no CSS framework, no test runner — intentionally minimal.

## PRD

**Problem.** Turning a written article into an on-brand Instagram carousel is manual and slow
(design tool, copy-paste, resize, export each frame).

**Goal.** Paste an article (or a structured deck) and get export-ready, on-brand carousel PNGs
in seconds, entirely in the browser — no account, no upload, no server cost.

**Users.** A solo content/marketing operator running the "insights" brand who wants consistent,
fast carousels from long-form articles.

**Scope (what it does):**
- Accepts three inputs: an **article URL** (fetched via CORS proxy), **pasted article text/HTML**,
  or a **slide-deck JSON**.
- Text and JSON inputs **auto-generate** the deck (400 ms debounce) — no button click; the primary
  button re-runs generation (and is the explicit trigger for URL fetches).
- A pasted blog is capped at **exactly 4 slides**: cover + 2 content points + outro/CTA.
- One **central image** is applied to every generated slide **except the CTA**.
- Output sizes: **Portrait 4:5 (1080×1350, recommended)** and **Square 1:1 (1080×1080)**.
- The wordmark is always the literal **"insights"** — never sourced from the JSON, pasted text,
  or article.
- 3 themes; download a single PNG or all slides as a ZIP.

**Non-goals:** AI/LLM summarisation, multi-brand/editable handle, scheduling or posting to
Instagram, video, accounts/persistence, server-side rendering.

**Success:** Paste → correct, legible, on-brand slides with no text overflow at either aspect
ratio; export matches the on-screen preview pixel-for-pixel.

## Inputs (any of)

1. **Article URL** — fetched via a public CORS proxy and parsed with a readability heuristic.
   Click **Fetch & generate**. If a site blocks the proxy, paste the text instead.
2. **Pasted article text or HTML** — generates slides automatically as you paste (always works
   offline). Capped at 4 slides (cover + 2 points + outro).
3. **Slide-deck JSON** — paste it (auto-generates) or click **Upload JSON file**. Shape:

   ```json
   {
     "cover":  { "title": "...", "content": ["para", "para"], "image": "hint" },
     "slides": [ { "title": "...", "content": ["..."], "image": "hint" } ],
     "cta":    { "headline": "...", "text": "...", "secondaryText": "..." }
   }
   ```

   Produces **1 cover + N slides + 1 CTA** images. See `public/sample-deck.json`.
   (`image` is a caption hint only — attach the real photo via the central **Image** upload.)

## Design

The renderer follows the "insights" reference deck, picking a layout per slide:

| Layout | When | Looks like |
|--------|------|-----------|
| **feature**     | cover, or any title-only slide (no body) | full-bleed photo + vertical opacity gradient + big title at the foot |
| **sand-top**    | odd content slide          | light surface, inset photo on top, title + body below |
| **dark-bottom** | even content slide         | deep surface, title + body up top, photo pinned full-bleed to the bottom |
| **cta**         | the outro                  | deep surface, stacked cream "marker" boxes (headline + url), follow line + wordmark |

Titles are clamped to a readable ~60 chars (preferring the first natural clause, never cutting a
word) and auto-fit (font shrinks, then ellipsis). Body line budgets adapt to the available height,
so nothing overflows at the shorter 1:1 size.

## Images

- A single **Image** upload (in the sidebar) is applied to **every generated slide except the CTA**,
  which keeps its solid marker-box layout.
- Photos are drawn `object-fit: cover` (centre-cropped) into each layout's image region; no upload =
  a graceful gradient/solid fallback.
- Everything stays in the browser — images are read as local object URLs, never uploaded.

## Output

- Aspect ratio **Portrait 4:5 (1080×1350, recommended)** or **Square 1:1 (1080×1080)**.
- 3 themes (Insights / Midnight / Plum); the wordmark is always **"insights"**.
- Download a single slide as PNG, or **all slides as a ZIP** (bulk). The on-screen preview is
  pixel-identical to the export (same canvas renderer; fonts + images preloaded first).

## Environment setup

**Prerequisites**
- **Node.js ≥ 18** (Vite 5 requires 18+ / 20+) and npm. Check with `node -v`.
- A modern browser (Canvas 2D + `document.fonts`). No `.env`, API keys, or services to configure —
  the app is fully client-side.

**First run**
```bash
git clone <repo-url> && cd igslides
npm install
npm run dev          # open http://localhost:5173
```

**Network notes**
- URL fetching uses a **public CORS proxy** at runtime — needs internet, and may fail for sites
  that block it (paste the article text as a fallback; it always works).
- **Poppins** loads from the Google Fonts CDN. Offline, the canvas falls back to the system font
  stack; layout still renders.
- The dev server binds to localhost only. To expose it on the LAN: `npm run dev -- --host`.

## Onboarding — new developer notes

**Mental model.** There is no backend and no global store. State lives in `App.tsx` hooks; the
pipeline is `input → Article | Slide[] → render to <canvas> → PNG/ZIP`. The **same** `render.ts`
draws both the live preview and the downloaded file, so "what you see is what you export."

**Where to start reading:** `App.tsx` (state + flow) → `render.ts` (all visual logic) →
`slides.ts` / `slideJson.ts` (how inputs become `Slide[]`).

**Conventions / gotchas:**
- Canvas draws are **synchronous**, so fonts and images must be preloaded first
  (`ensureFonts()`, `preloadImage()`); always repaint after they resolve.
- Sizes/colours are derived from canvas width (`w * 0.0xx`) — keep new measurements proportional,
  not hard-coded pixels, so both aspect ratios stay correct.
- The wordmark is a **fixed constant** (`BRAND = "insights"`); never wire it to user input.
- Pasted blogs are **structurally** capped at 4 slides in `buildSlides` — don't reintroduce a
  variable point count there.
- The central image is excluded from the CTA in `App.tsx`'s `slides` memo — preserve that.
- Run `npm run build` before committing: it type-checks (`tsc -b`) and will fail on TS errors that
  `dev` tolerates.

**Common changes:**
- *New theme* → add an entry to `THEMES` in `render.ts`.
- *Layout tweak* → edit the matching `draw*` function in `render.ts`.
- *Input parsing* → `extract.ts` (article/HTML) or `slideJson.ts` (deck JSON).

## Structure

| File | Responsibility |
|------|----------------|
| `src/lib/extract.ts`   | URL fetch (CORS proxy) + HTML/text → `Article` |
| `src/lib/slideJson.ts` | Slide-deck JSON → `Slide[]` |
| `src/lib/slides.ts`    | Article → `Slide[]` heuristic (cover + 2 points + outro, capped at 4) |
| `src/lib/render.ts`    | Canvas renderer — exact IG sizes, themes, word-wrap, PNG export |
| `src/lib/download.ts`  | Single PNG + ZIP download |
| `src/components/SlidePreview.tsx` | Live canvas preview |
| `src/App.tsx`          | UI / state |
