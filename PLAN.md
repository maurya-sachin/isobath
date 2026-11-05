# PLAN

Open work and settled rules only. Keep it lean: see `CLAUDE.md` → Plan hygiene.

## Now
- Branch `dev`; production `main` = release of 2026-10-30 (browser drafts). Tags `v1-archive` (v1 source), `v1-site-archive` (v1 built site), `archive/improvements` (unmerged v1 fixes).
- Done, all `draft`: JS 183 q / 1088 cards, TS 63 / 762, HTML and CSS 61 / 1083, browser 51 / 851, React 54 / 1117. Limits are labelled in the text (React runs: 19.3.1 in Chrome 156 + Firefox 159, server APIs on Node 24; browser runs: Chrome 156 + Firefox 159 headless, Safari from compat data; JS ch 18–22 Chrome 155 only; TS 7.1 from 7.1.0-beta; V8 natives on Node 24.19).
- On `dev`, unmerged (maintainer merges at EOD): 6.1 rewrite fix (then curl `/flashcards/react` live), 6.2 example runner (272 JS examples run, 48 `no-run`), 6.3 og cards (412 PNGs, +13 s build; check a shared link with a card validator after deploy), 6.4 giscus comments (built-in light/dark theme; `giscus.json` origins apply once merged to `main`), 6.6 Anki decks (`/data/topics/<slug>/anki.txt`; import into Anki once to confirm).
- Repo renamed `isobath` (2026-11-05); `dev` not yet pushed since. Awaiting maintainer: run the Pages shutdown (`gh api -X DELETE repos/maurya-sachin/isobath/pages`, delete `gh-pages`, delete env `github-pages`); publish the dev.to draft "I rebuilt my interview prep repo…" (update counts if React ships first); pin isobath on dev.to; Phase 5 reviews; wordmark redraw.
- Now: 6A built and verified (palette, Appearance panel, fonts, a11y; settings checked on 1,854 text elements); left: T3 no-drafts build check, T5 manual passes, T6 after deploy. 6B Q1 done; next C1 complexity fixes, then Q2 (Lighthouse, 511 kB bundle), then 6.5 (per-chapter `cheatsheet.json` of styled TL;DRs), then Tier 2. Phase 7 (`nextjs`) waits until Phase 6 tier 1 and 6.10 ship; tier 2–3 then alternate with content.
- Open question: relax the review gate to "examples pass CI (6.2) + one maintainer pass per chapter"?

## Goal
Interview Q&A for any software engineer — language → spec/engine → runtimes → frontend, backend, infrastructure, practice. Not introductory.
Each question: interview answer first, then mechanism, edge cases, exercises. A topic reads in order like a book.
Non-goals: backend service, accounts, paid AI.

## Rules (settled — change only on maintainer request)
- R1 Content lives in the repo; contributions via PR. The app is client-only and reads generated JSON.
- R2 One `.md` per question: frontmatter (meta + `tldr`) + fixed `##` sections. Path = id + order: `content/<topic>/<NN-chapter>/<NNN-slug>.md`, numbered in steps of 10.
- R3 Never hand-write derivable data (id, topic, chapter, counts) — generate it.
- R4 Every topic and chapter folder has a README: scope, sub-topics, sources, question list, status line. Questions exist as `status: planned` stubs before writing.
- R6 Research before writing. Primary sources (ECMAScript spec, TC39, MDN, engine blogs, official docs) go in `sources`. Coverage is checked against YDKJS / javascript.info / spec tables of contents — titles only, never copy text.
- R7 App is self-contained in `app/`: Vite, React 19, TypeScript, Tailwind 4, shadcn/ui, React Router; Markdown + Shiki compiled at build.
- R8 Flashcards are separate: `content/flashcards/<topic>.yaml`. A build ships a card only when its `question` has a page (draft or published).
- R9 npm; scripts run on Node 24 native TypeScript.
- R11 Coverage lives in READMEs: each chapter sub-topic points to its questions or ends `→ —` (gap); topic READMEs list areas with no chapter under **Not yet mapped**. New content goes through `templates/README.md` → Adding content.
- R12 One topic per subject, grouped into tracks; each topic README has a `> **Track:**` line directly above its status line. A topic with no chapters keeps its planned structure in **Not yet mapped**. Track membership: `templates/README.md` → README status lines.
- R13 Brand: **isobath, by Sachin Maurya**, "engineering interviews, in depth". Wordmark = "isobath" with a contour ring as its "o"; the favicon is that ring; topic covers are generated from slug + data (`app/src/lib/contours.ts`); depth scale = `--depth-1..4`. Type: Geist, Geist Mono, Newsreader (SIL OFL); accent #2F4FD8 / #9DAEF7; prose column 720px. Originals only.
- R14 Hosting: Vercel, host `learn.sachinmaurya.com`, production from `main`. Project root = repo root (Vercel's Root Directory can't reach `../content`); `vercel.json` builds `app/`, sets `cleanUrls`, rewrites unknown paths to `/app-shell` (with `cleanUrls`, the `.html` destination is 308-redirected and 404s) and redirects `/portfolio`. The old GitHub Pages site is retired.
- R15 Data: `manifest.json` + `topics/<slug>/{index,search,flashcards}.json`; a topic's shard loads on demand, never one big file.
- R16 Licence: code MIT (`LICENSE`); questions and flashcards in `content/` CC BY-NC-SA 4.0 (`content/LICENSE`).
- R17 Paths: `content/paths/<role>.yaml` (ordered `<topic>` or `<topic>/<chapter>` entries with a one-line `why`, unique `order`, optional `start` question), validated by `content:check`; format in `templates/README.md` → Paths.
- R18 Progress backup: JSON `isobath-progress` v1; import merges and never carries HTML; max 20 new flashcards per session.
- R19 Prerender: every content page ships as `dist/<path>.html` and hydrates; no module touches `window`/`document`/`localStorage` at import time; browser-only state renders neutral on the server; unknown paths fall back to `app-shell.html`.
- R20 Freshness: stale = verified 12+ months before the build month; labels Draft/Reviewed/Legacy come from `status` and `legacy`; `Covers` is authored in topic READMEs directly above Track; the changelog lists published questions only.
- R23 Colour has one source: `src/theme/palette.ts`; never hard-code a colour elsewhere. Users pick a hue only; lightness is fixed so contrast holds.
- R22 JS examples with `// →` run in CI (`examples:check`, spec `docs/superpowers/specs/2026-11-05-example-runner-design.md`); fence meta `script`/`no-run`; a new example must pass or say why it can't.
- R21 Content accuracy work (writing questions, audits) runs on Opus; Sonnet only for mechanical work such as flashcards from finished text.

## Phases

### 5 — Review and publish
- [ ] Per question: maintainer review → `published`; update README status lines

### 6A — Theme "Chart" and accessibility (spec `docs/superpowers/specs/2026-11-05-theme-and-accessibility-design.md`; before 6.5)
- [ ] T3 Verify in a no-drafts build (Chrome and Firefox, four widths, light/dark and 145 % text checked on the full build)
- [ ] T5 Remaining: screen-reader pass (VoiceOver, NVDA) and a forced-colours look on real Windows (maintainer)
- [ ] T6 Giscus custom theme from the palette (after deploy)

### 6B — Quality gate: SEO, accessibility, performance (after 6A; each item gets a short spec first)
- [ ] Q1 SEO: JSON-LD (`BreadcrumbList` everywhere, `LearningResource` on questions), real 404 status for unknown paths (today `app-shell` answers 200 with `noindex`), `og:image` for home/topic/chapter pages, `theme-color` and apple-touch-icon, sitemap `lastmod` from `verified`, unique titles/descriptions check; Rich Results and Search Console checks after deploy (maintainer)
- [ ] Q2 Lighthouse (mobile and desktop) on home, topic, chapter, question, practice: fix perf, a11y, best-practices, SEO findings; split the 511 kB main chunk; keep a budget
- [ ] Q4 Responsive and cross-browser smoke in CI: `puppeteer-core` against the built site (Chrome and Firefox; 375/768/1024/1440 px; light, dark and 145 % text; fails on horizontal overflow, console errors or axe violations; the axe and keyboard scripts also live only in the scratchpad); the harness now lives only in a scratchpad. Safari (macOS and iOS) and Android Chrome are maintainer checks on real devices after deploy
- [ ] Q3 Security headers in `vercel.json` (CSP that allows giscus and the inline theme script, nosniff, referrer and permissions policy)

### 6C — Code complexity (global rule: ≤ 8 per function)
- [ ] C1 Bring the remaining source functions above 8 down, one directory per commit; `scripts/lib` validators `checkSection`, `checkReferences`, `validateRolePaths` are done. Next: `TopicPage` 24, `QuestionPage` 24, `Session` 14, `onKeyDown` 13, `ringsAtHeight` 11, `parseBackup` 11, `parseAppearance` 11, then the 10s
- [ ] C2 Turn on ESLint `complexity` as an error at 10 once C1 is done (and ignore `dist-server`)

### 6 — Product features (free, OSS deps only; each gets a short spec + OK before code)
Tier 1:
- [ ] 6.1 Fix NOT_FOUND on direct loads (`vercel.json` rewrite)
- [ ] 6.2b Shrink the 48 `no-run` JS examples: multi-file blocks, Node flags (`--expose-gc`, `--allow-natives-syntax`), env vars, earlier-block continuation, `…` elision for noisy lines; then extend to `typescript` (6.13 for browser topics)
- [ ] 6.5 Printable chapter cheat sheet (all `tldr`s of a chapter)
Tier 2:
- [ ] 6.7 Mock interview mode: timed random questions from a path, reveal `tldr`, self-grade into FSRS
- [ ] 6.8 Cross-topic search with Pagefind (may replace minisearch)
- [ ] 6.9 Offline reading/flashcards (`vite-plugin-pwa`)
- [ ] 6.10 Slim hydration data: pages embed their chapter, not the whole topic index (~131 KB of a 150 KB chapter page today)
- [ ] 6.11 Weekly source link check (lychee) opening an issue
- [ ] 6.12 Privacy-friendly page counts (GoatCounter) to order reviews
Tier 3:
- [ ] 6.13 "Run" for JS examples in a sandboxed Web Worker (replaces parked Sandpack)
- [ ] 6.14 Build-time SVG diagrams (Mermaid) for event loop, rendering pipeline, Fiber
- [ ] 6.15 DSA problems with tests on the 6.13 runner
- [ ] 6.16 Script that opens a `good first issue` per planned stub / `→ —` gap
Skip: AI features, accounts/sync, company tags, i18n (until traffic).

### 7 — Next topics
- [ ] Per topic: chapters + stubs from its **Not yet mapped** list, then content
  - Browser-run examples (HTML, CSS, DOM and Web APIs) run in the installed Chrome and Firefox via puppeteer-core in the scratchpad, never in the repo; browser-specific behaviour names the browser and version.

## Parked (don't start without maintainer)
Supabase sync/votes · in-browser AI (WebLLM + retrieval; no paid APIs, no fine-tuning)
