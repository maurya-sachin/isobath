# Browser smoke test in CI (PLAN Q4)

Today the responsive, dark-mode, large-text and accessibility checks run by hand in a scratchpad harness. This makes them a command and a CI job, so a change that overflows at 375 px, throws in Firefox, breaks contrast in dark mode or trips a CSP rule fails before merge.

## What it checks
For each page type, in each browser, at each combination of:
- width 375, 768, 1024, 1440 px (height 900);
- theme light and dark, set the way the app stores it (`localStorage.theme`), so the real toggle code path is used;
- text size 100% and 145%, set through the Appearance setting (`localStorage.appearance`, `textSize: 145`), not a CSS hack;

it fails on any of:
1. **Horizontal overflow**: `documentElement.scrollWidth > clientWidth`.
2. **Console errors**, uncaught exceptions, `securitypolicyviolation` events, or same-origin requests answered 4xx/5xx.
3. **axe-core violations** for WCAG 2.0/2.1/2.2 A and AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`), with the rule id and the first failing node's selector in the report.
4. **Keyboard**: the first Tab lands on "Skip to content"; 40 further Tab presses never focus an element that is hidden or has zero size.

Pages (one of each kind, fixed in the script): home, a topic, a chapter, a question, roadmap, paths, a path, the practice hub, a practice topic, flashcards, a cheat sheet, and an unknown URL (the 404 page). That is 12 pages × 4 widths × 2 themes × 2 sizes = 192 runs per browser; at about 1.5 s each, a few minutes.

## Browsers
`puppeteer-core` (no browser download) drives Chrome through CDP and Firefox through WebDriver BiDi. Paths come from `CHROME_PATH` and `FIREFOX_PATH`, defaulting to the usual locations; GitHub's `ubuntu-latest` runner has both installed. Safari (macOS and iOS) and Android Chrome stay maintainer checks on real devices.

## Serving
`scripts/serve-dist.ts`: a small `node:http` server for `app/dist` that reads the repo's `vercel.json` and applies its `cleanUrls`, `rewrites` (`:param` patterns) and `headers`, and answers unknown paths with `404.html` and status 404. The smoke test therefore sees the real CSP, the client-only routes and the 404 page, which `vite preview` and `serve` do not reproduce. Limits: it implements only the `vercel.json` features this repo uses; anything else in the file makes it throw, so it cannot silently diverge.

## Wiring
- `scripts/lib/smoke.ts` (pure, `node:test` covered): the page list, the run matrix, the rewrite/clean-URL matcher used by the server, and the report formatting.
- `scripts/smoke.ts`: serve, launch, loop, report; exit 1 on any failure. `npm run smoke -- --browser chrome|firefox` in `app/`, after `npm run build`.
- `.github/workflows/ci.yml`: a `smoke` job per browser (matrix), each running `npm ci`, `npm run build`, `npm run smoke`; it runs in parallel with `check`. No artifacts passed between jobs.
- New devDependencies: `puppeteer-core` (Apache-2.0) and `axe-core` (MPL-2.0), both free and open source; axe is read from `node_modules` and injected as text, never fetched from a CDN.

## Not doing
- Visual regression, Lighthouse in CI, screen-reader testing, or a per-rule allow-list: a failure is fixed, or the check's scope is changed in a reviewed commit with the reason.
- More page samples than the 12 above; the run count already costs minutes.

## Verification
- `scripts/lib/smoke.ts` tests: matrix size, rewrite matching (`/practice/:topic/:chapter`), clean URLs, the 404 fallback, unsupported `vercel.json` keys throwing.
- Run locally in Chrome and Firefox on a current build: expected to find real issues the first time; each is fixed in its own commit before the CI job is added, so CI starts green.
- A deliberate break (a 400 px-wide element on one page) shows up as an overflow failure in both browsers, then is reverted.
