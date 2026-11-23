# PLAN

Open work and settled rules only. Keep it lean: see `CLAUDE.md` → Plan hygiene.

## Now
- Branch `dev`, ahead of `main` by the Next.js chapters 08-10, the table focus fix, and the analytics accuracy work (spec `docs/superpowers/specs/2026-11-09-analytics-accuracy-design.md`: lazy PostHog, `/soundings` proxy, six events, device opt-out) plus the `src/` regrouping. Pushed as `preview/analytics-proxy`; release needs the maintainer's OK.
- Preview checked in Chrome with a blocker: events pass, `$autocapture`/`$pageleave`/`$web_vitals` arrive, country reaches PostHog. Open: `dead-clicks-autocapture.js` is still blocked by filename; `/soundings/i/v0/e/` with a trailing slash answers a 308; event properties and Firefox, 375-1440 px unchecked.
- Next: release; then after ~3 days of data the dashboard (spec T6) and memory `posthog-analytics`. Optional: remove `VITE_POSTHOG_KEY` from Vercel Preview.
- Done, all `draft`: Next.js 50 q, JS 183, TS 63, HTML and CSS 61, browser 51, React 54. Open content fixes: 03/040 `connection()` in `use cache: private`; `previous-caching/default-cache-locations` route-cache path (see 09/030).
- Awaiting maintainer: chapter passes; Search Console and Rich Results checks; card-validator check; one Anki import; 6A T5; wordmark redraw.

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
- R13 Brand: **isobath, by Sachin Maurya**, "engineering interviews, in depth". Wordmark = "isobath" with a contour ring as its "o"; the favicon is that ring; topic covers are generated from slug + data (`app/src/geometry/contours.ts`); depth scale = `--depth-1..4`. Type: Geist, Geist Mono, Newsreader (SIL OFL); accent #2F4FD8 / #9DAEF7; prose column 720px. Originals only.
- R14 Hosting: Vercel, host `learn.sachinmaurya.com`, production from `main`. Project root = repo root (Vercel's Root Directory can't reach `../content`); `vercel.json` builds `app/`, sets `cleanUrls`, rewrites unknown paths to `/app-shell` (with `cleanUrls`, the `.html` destination is 308-redirected and 404s) and redirects `/portfolio`. The old GitHub Pages site is retired.
- R15 Data: `manifest.json` + `topics/<slug>/{index,search,flashcards}.json`; a topic's shard loads on demand, never one big file.
- R16 Licence: code MIT (`LICENSE`); questions and flashcards in `content/` CC BY-NC-SA 4.0 (`content/LICENSE`).
- R17 Paths: `content/paths/<role>.yaml` (ordered `<topic>` or `<topic>/<chapter>` entries with a one-line `why`, unique `order`, optional `start` question), validated by `content:check`; format in `templates/README.md` → Paths.
- R18 Progress backup: JSON `isobath-progress` v1; import merges and never carries HTML; max 20 new flashcards per session.
- R19 Prerender: every content page ships as `dist/<path>.html` and hydrates; no module touches `window`/`document`/`localStorage` at import time; browser-only state renders neutral on the server; unknown paths fall back to `app-shell.html`.
- R20 Freshness: stale = verified 12+ months before the build month; labels Draft/Reviewed/Legacy come from `status` and `legacy`; `Covers` is authored in topic READMEs directly above Track; the changelog lists published questions only.
- R23 Colour has one source: `src/theme/palette.ts`; never hard-code a colour elsewhere. Users pick a hue only; lightness is fixed so contrast holds.
- R22 JS examples with `// →` run in CI (`examples:check`, spec `docs/superpowers/specs/2026-11-05-example-runner-design.md`); fence meta `script`/`no-run`; a new example must pass or say why it can't.
- R24 Publishing happens once, at the end, when all phases are complete: every question goes `published` together on the maintainer's OK, and the site's Draft label and the dev.to post's "everything is Draft" paragraph change with it. Until then all content stays `draft`.
- R21 Content accuracy work (writing questions, audits) runs on Opus; Sonnet only for mechanical work such as flashcards from finished text.

## Phases

### 5 — Review and publish
- [ ] At the end (R24): maintainer pass → all `published`; `content:sync` updates README status lines

### 6A — Theme "Chart" and accessibility (spec `docs/superpowers/specs/2026-11-05-theme-and-accessibility-design.md`)
- [ ] T5 Remaining: screen-reader pass (VoiceOver, NVDA) and a forced-colours look on real Windows (maintainer)

### 6 — Product features (parked until more topics exist; each gets a short spec + OK before code)
In this order when picked up; model for the build in brackets:
- [ ] 6.8 Cross-topic search with Pagefind (may replace minisearch) [Sonnet]
- [ ] 6.7 Mock interview mode: timed random questions from a path, reveal `tldr`, self-grade into FSRS [Sonnet]
- [ ] 6.9 Offline reading/flashcards (`vite-plugin-pwa`) [Opus spec, Sonnet build: cache bugs ship easily]
- [ ] 6.13 "Run" for JS examples in a sandboxed Web Worker (replaces parked Sandpack) [Opus: runs code in the browser]
- [ ] 6.14 Build-time SVG diagrams (Mermaid) for event loop, rendering pipeline, Fiber [Sonnet]
- [ ] 6.12 Privacy-friendly page counts (GoatCounter) to order reviews [Sonnet]
- [ ] 6.15 DSA problems with tests on the 6.13 runner [Sonnet]
Skip: AI features, accounts/sync, company tags, i18n (until traffic).

### 7 — Next topics
- [ ] Per topic: chapters + stubs from its **Not yet mapped** list, then content. Next: `nextjs`.
  - Order: nextjs → state-and-data-fetching → accessibility → react-native → web-performance → web-security → testing → tooling → nodejs → http-and-apis → authentication → databases → caching → backend-patterns → messaging-and-jobs → git → ci-cd → networking → containers-and-kubernetes → cloud-and-iac → observability → data-structures-and-algorithms (after 6.15) → system-design.
  - Main session on Sonnet coordinates (briefs, checks hand-backs, commits); the topic spec and the questions go to an Opus agent (`question-writer`, R21); flashcards to the Sonnet `flashcards` agent.
  - Browser-run examples (HTML, CSS, DOM and Web APIs) run in the installed Chrome and Firefox via puppeteer-core in the scratchpad, never in the repo; browser-specific behaviour names the browser and version.

## Parked (don't start without maintainer)
Supabase sync/votes · in-browser AI (WebLLM + retrieval; no paid APIs, no fine-tuning)
