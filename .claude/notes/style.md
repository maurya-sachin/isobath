# Repo conventions

Rules: `PLAN.md`. Layout: `README.md`. Templates: `templates/`.
Record here only conventions not covered there (e.g., maintainer corrections). Delete entries once they're obsolete.

## App (`app/`)
- Formatting is Prettier (`npm run format`, checked in CI): no semicolons, single quotes, 120 columns. It skips `content/`, Markdown, `src/components/ui/` and generated files.
- TypeScript stays `~6.0` until typescript-eslint's peer range allows 7 (it caps at `<6.1`).
- `src/components/ui/` is shadcn-generated: add components with `npx shadcn add`, don't hand-edit; ESLint's react-refresh rule is off there.
- Layout: `src/` is grouped by feature (`analytics`, `appearance`, `geometry`, `hooks`, `learning`, `questions`; leftovers in `lib`). "content" means only the root `content/` Markdown; code about it lives in `src/questions`.
- Tests: `node:test` files, run by `npm test`. Tests of `src/` logic sit beside the module (`src/**/x.test.ts`, excluded from the app tsconfig, included in the node one); build-script tests are in `app/scripts/lib/`. Pure logic gets a test; pages are verified in the browser.
- Modules shared by `src/` and `scripts/` (e.g. `src/questions/stats.ts`, `src/geometry/contours.ts`) import relatively with `.ts` extensions; `@/` doesn't resolve in Node or the scripts tsconfig.
- Contour rings take their colour from `depthStrokeClass` (`src/geometry/depth.ts`); the palette tests keep the ramp readable.
- Pages are prerendered (R19): never read `window`, `document` or `localStorage` at module load or during the first render; use `useSyncExternalStore` with a server snapshot. Every prerendered page must render a `<title>`.
- Session focus and keys: `useShortcuts` (Enter/Space stay native on links and buttons) and `useSessionFocus`.
- Browser-only stores live apart from pure logic so Node tests never compile DOM code: `src/questions/reviewStore.ts` (flashcard history) vs `src/questions/review.ts`; `src/learning/progress.ts` vs `src/learning/progressTypes.ts`. Never add `/// <reference lib="dom" />` to shared modules.
- Prerendered pages show browser-only counts only after hydration (`useHydrated`), with the space reserved, so the first paint is neutral.
- Route visuals (`RouteDiagram`, `RouteSummary`): states differ by shape as well as colour (check, filled, half, hollow).
- Testing comments locally: `giscus.json` allows only production and `localhost:5173`, and browsers block giscus.app from loading our `localhost` theme CSS (local network access). Serve on `localhost:5173` and launch the test browser with Chrome `--disable-features=LocalNetworkAccessChecks` or Firefox pref `network.lna.enabled=false`.

## Content (`content/`)
- New chapters are appended after the last number (JS 27, 28) rather than renumbering folders; question ids carry no numbers, so order is the only cost.
- Flashcard backs are double-quoted YAML: escape inner `"`.
- A concept listed in two chapters' sub-topics gets one owner: keep its line where the question lives and delete the other (sub-topics can only point to their own chapter's numbers).
