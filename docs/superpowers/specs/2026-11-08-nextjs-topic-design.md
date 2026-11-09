# Next.js topic (PLAN Phase 7)

Draft for the maintainer's review. It turns `content/nextjs/README.md` → **Not yet mapped** into chapters and planned questions. No stubs or chapter READMEs exist until this spec is approved. Every version fact below was read from nextjs.org (docs pages report `@doc-version: 16.4.5`) and the npm registry on 2026-11-08.

## 1. Target version and drift
- **Target: Next.js 16.4.x** (`latest` = 16.4.5, published 2026-11-03), **React 19.3** (16.4 release post; npm `react` 19.3.1), **Node 24** (`app/.node-version`; Next 16 needs Node 20.9+). App Router throughout; the Pages Router only in chapter 10.
- Topic README gets `> **Covers:** Next.js 16.4, React 19.3, Node 24; App Router, Pages Router in chapter 10` (14 words).
- **Drift is unusually fast here.** 16.0 (2025-10-21), 16.3 (2026-08-03) and 16.4 (2026-10-06) each changed caching or navigation APIs. So:
  - Each question names the Next.js version it ran on, and lists version-bound facts in `perishable` (flag names, defaults, `unstable_`/Canary status).
  - Where an API changed in 15 or 16, the text gives the current behaviour and one *Legacy:* sentence with the version it changed in. No version tables.
  - The `cacheComponents` docs say both `cacheComponents` and `partialPrefetching` "will be enabled everywhere in the next major release, and the options will be removed". When 17 ships: `content:status -- --stale nextjs`, rewrite chapters 03 and 06, and mark chapter 04 `legacy`.
  - Canary-only APIs (`authInterrupts` → `forbidden`/`unauthorized`; React `taint`) are mentioned at most in a Follow-up, never as the answer.

### Recent changes each writer must check against the docs, not memory
| Change | Version | Source |
|---|---|---|
| `cookies`, `headers`, `draftMode`, `params`, `searchParams` async only; sync access removed | 15 → 16 | upgrading/version-16 |
| `fetch` not cached by default; client router `staleTimes.dynamic` 30 s → 0 | 15.0 | version-15, staleTimes |
| `cacheComponents` stable and top-level, replaces `experimental.ppr`/`dynamicIO`/`useCache`; opt-in, off by default | 16.0 | cacheComponents |
| `use cache`, `use cache: private`, `use cache: remote`; `cacheLife`/`cacheTag` lose `unstable_` | 16.0 | use-cache |
| `revalidateTag(tag)` needs a `cacheLife` profile as 2nd argument; new `updateTag`, `refresh` | 16.0 | version-16 |
| `middleware.ts` → `proxy.ts`; Proxy is Node.js only, `runtime` config throws there | 16.0 | proxy.js |
| `runtime = 'edge'` deprecated for routes (message `edge-runtime-deprecated`); release that deprecated it ❓ | 16.x | runtime |
| Turbopack default for `dev` and `build`; `next lint` removed; parallel slots need `default.js` | 16.0 | version-16 |
| `next/image` defaults (`minimumCacheTTL`, `qualities`, `imageSizes`, local IP block, query strings need `localPatterns.search`) | 16.0 | version-16 |
| `partialPrefetching`, `instant` (stable), `next/root-params` | 16.3 | partialPrefetching, instant |
| `ensureStatic` | 16.4 | ensureStatic |
| Cache Components keeps routes mounted with React `<Activity>` on navigation | 16.x | cacheComponents |
| `adapterPath` (Build Adapters) stable, top-level | 16.2 | adapterPath |

## 2. Chapters
Chapter folders use two digits (`templates/README.md`); questions are numbered in steps of 10 (R2). Order: routes, then when they render, then what is cached, then how writes and navigation use the cache, then the edges (handlers, assets, deployment, old router). 10 chapters, 50 questions.

| # | Chapter (folder) | Scope | Goals |
|---|---|---|---|
| 01 | App Router structure (`01-app-router`) | File conventions and the component tree they produce; layouts, templates, groups, parallel and intercepting routes | 6 |
| 02 | Static, dynamic and prerendered (`02-rendering`) | What makes a route build-time or request-time; async request APIs; Partial Prerendering; client boundary placement in a Next app | 6 |
| 03 | Cache Components (`03-cache-components`) | `use cache` and its keys, `cacheLife`, `cacheTag`, private/remote variants, where cached output lives | 5 |
| 04 | Caching without Cache Components (`04-previous-caching`) | Today's default: `fetch` options, segment config, `unstable_cache`, request dedup, how defaults moved 14 → 16 | 4 |
| 05 | Mutations and revalidation (`05-mutations`) | Server Actions as Next wires them, `revalidatePath`/`revalidateTag`/`updateTag`/`refresh`, ISR, action security | 5 |
| 06 | Navigation and prefetching (`06-navigation`) | `<Link>`, prefetching and Partial Prefetching, the client router cache, `<Activity>` state, `redirect`/`notFound` control flow | 5 |
| 07 | Route handlers, Proxy and request hooks (`07-route-handlers-and-proxy`) | `route.ts`, `proxy.ts`, `after`, instrumentation | 5 |
| 08 | Images, fonts, scripts and metadata (`08-optimizations`) | What `next/image`, `next/font`, `next/script` and the Metadata API do and still leave to you | 5 |
| 09 | Build output, runtimes and self-hosting (`09-deployment`) | `next build` output, Node vs deprecated Edge, `standalone`/`export`, multi-instance hosting, env inlining, version skew | 5 |
| 10 | The Pages Router and migration (`10-pages-router`) | Data functions, `_app`/`_document`, coexisting routers, moving a page to `app/` | 4 |

Planned questions (title, then difficulty, frequency in brackets):

**01** 010 How does the App Router turn folders and special files into a component tree? (medium, 4) · 020 Why does a layout keep its state on navigation, and when do you need `template.js`? (medium, 3) · 030 How do `loading.js`, `error.js` and `not-found.js` map onto Suspense and error boundaries? (medium, 4) · 040 What are parallel routes, and why must every slot have `default.js`? (hard, 2) · 050 How do intercepting routes give a modal its own URL that survives a refresh? (hard, 3) · 060 What do route groups and multiple root layouts change about navigation? (medium, 2)

**02** 010 What decides whether a route is prerendered at build time or rendered per request? (hard, 5, core) · 020 Why are `params`, `searchParams`, `cookies()` and `headers()` async? (medium, 4) · 030 What is Partial Prerendering, and what ends up in the static shell? (hard, 4, core) · 040 How do `generateStaticParams` and `dynamicParams` handle paths unknown at build time? (medium, 3) · 050 Where should `"use client"` go in a Next.js page, and what does a high boundary cost? (medium, 4) · 060 How do you keep a route static, and how do you find what made it dynamic? (hard, 2)

**03** 010 What does `use cache` cache, and how is its cache key built? (hard, 4, core) · 020 Why can't a cached function read `cookies()`, and how do you pass request data into one? (hard, 3) · 030 How do `cacheLife` profiles map to stale, revalidate and expire times? (medium, 3) · 040 When do you need `use cache: private` or `use cache: remote`? (hard, 2) · 050 How does `use cache` differ from React's `cache` and from `unstable_cache`? (medium, 3)

**04** 010 Without Cache Components, what does Next.js cache, and where? (hard, 4, core) · 020 How did caching defaults change from Next.js 14 to 15 to 16, and why? (medium, 4) · 030 What do `dynamic`, `revalidate` and `fetchCache` segment configs do? (medium, 3) · 040 When are two `fetch` calls deduplicated, and when are they not? (medium, 3)

**05** 010 How does a Server Action update the page in a single round trip? (hard, 4, core) · 020 What is the difference between `revalidatePath`, `revalidateTag`, `updateTag` and `refresh`? (hard, 4) · 030 How does ISR serve a stale page, and what does on-demand revalidation do across instances? (hard, 4) · 040 Why must every Server Action check authorization itself? (hard, 4) · 050 How do you show errors and pending state for a Server Action form without client JS? (medium, 3)

**06** 010 What happens between clicking a `<Link>` and the new page appearing? (hard, 5, core) · 020 What does Next.js prefetch, and what did Partial Prefetching change? (hard, 3) · 030 How long does the client router reuse a page, and what do `staleTimes` control? (medium, 3) · 040 Why does a page keep its state after navigating back with Cache Components on? (medium, 2) · 050 Why do `redirect()` and `notFound()` throw, and what goes wrong in a `try`/`catch`? (medium, 3)

**07** 010 When do you write a route handler instead of a Server Action? (medium, 4) · 020 What is `proxy.ts`, what should run there, and why was `middleware` renamed? (medium, 4) · 030 Why is Proxy not enough for authorization? (hard, 4) · 040 What does `after` run, and when does it run relative to the response? (medium, 2) · 050 What do `instrumentation.ts` and `onRequestError` hook into? (medium, 2)

**08** 010 What does `next/image` do to an image, and what must you still supply? (medium, 4) · 020 How does `next/font` avoid layout shift and third-party font requests? (medium, 3) · 030 How does `generateMetadata` interact with streaming and request dedup? (hard, 3) · 040 What do the `next/script` strategies change about load order? (medium, 2) · 050 How are file-based metadata routes (`opengraph-image`, `sitemap`) generated and cached? (medium, 2)

**09** 010 What does `next build` produce, and what runs where under `next start`? (hard, 4, core) · 020 Why is the Edge Runtime deprecated, and what did it trade away? (medium, 3) · 030 What breaks when you run a Next.js app on several instances? (hard, 3) · 040 What does `output: 'export'` give up? (medium, 3) · 050 Why does a `NEXT_PUBLIC_` variable keep its old value after the environment changes? (medium, 3)

**10** 010 How do `getStaticProps`, `getServerSideProps` and `getStaticPaths` map to App Router code? (medium, 4) · 020 What changes about data, layouts and client JavaScript when a page moves to `app/`? (medium, 3) · 030 Can `pages/` and `app/` coexist, and what isn't shared between them? (medium, 2) · 040 What did `_app` and `_document` do, and what replaces them? (easy, 2)

**Boundaries kept.** React owns what RSC, `"use client"`, Server Functions, Suspense, streaming, hydration and `<Activity>` *are*; these questions start from that and cover only what Next adds (file conventions, the cache, the router). Status codes and `Cache-Control` semantics belong to HTTP and APIs, Core Web Vitals to Web performance, CSRF and XSS to Web security, sessions to Authentication.

## 3. Cross-topic links (`related`)
| Next.js question | Links to |
|---|---|
| 01/030 | `react/suspense/error-boundaries`, `react/suspense/suspense-mechanics` |
| 01/020, 06/040 | `react/reconciliation/activity` |
| 02/010, 02/030 | `react/server-rendering/streaming-and-selective-hydration`, `react/server-components/rsc-vs-ssr` |
| 02/050 | `react/server-components/client-boundary`, `react/server-components/rsc-serialization` |
| 03/010, 03/050 | `react/suspense/use-api`, `react/server-components/rsc-serialization` |
| 05/010, 05/040 | `react/server-components/server-functions`, `react/forms-and-actions/actions` |
| 05/050 | `react/forms-and-actions/use-action-state`, `react/forms-and-actions/use-optimistic` |
| 06/010 | `browser/navigation/history-api-routing` |
| 06/030 | `browser/navigation/back-forward-cache` |
| 04/040 | `browser/network-apis/fetch-request-options` |
| 08/010 | `react/server-rendering/hydration-mismatches` (only where `priority`/`preload` matters for first render) |

Ids follow the path rule and must be confirmed with `content:check` when written. HTTP and APIs, Caching, Web performance, Web security and Authentication have no chapters yet: link those topic READMEs in prose, not `related`.

## 4. Primary sources per chapter
Docs pages under `https://nextjs.org/docs/app/…` unless a full URL is given. Release posts (`nextjs.org/blog/next-16`, `next-16-3`, `next-16-4`) only to date a change; the reference page is the source.
- **01** getting-started/layouts-and-pages; file-conventions: layout, template, loading, error, not-found, default, parallel-routes, intercepting-routes, route-groups.
- **02** getting-started/caching#prerendering; glossary (request-time APIs, PPR); functions: cookies, headers, connection, generate-static-params; route-segment-config: dynamicParams, instant, ensureStatic; getting-started/server-and-client-components.
- **03** directives: use-cache, use-cache-private, use-cache-remote; functions: cacheLife, cacheTag; config: cacheComponents, cacheHandlers, cacheLife; guides/migrating-to-cache-components; react.dev `cache`.
- **04** guides/caching-without-cache-components; functions: fetch, unstable_cache; route-segment-config; guides/upgrading/version-15 (defaults change).
- **05** getting-started/mutating-data, getting-started/revalidating, guides/how-revalidation-works, guides/incremental-static-regeneration, guides/forms, guides/data-security; functions: revalidatePath, revalidateTag, updateTag, refresh; `nextjs.org/blog/security-nextjs-server-components-actions`, `nextjs.org/blog/CVE-2025-66478`.
- **06** getting-started/linking-and-navigating; components/link; config: staleTimes, partialPrefetching; guides/adopting-partial-prefetching, guides/preserving-ui-state; functions: redirect, not-found, unstable_rethrow, use-link-status.
- **07** getting-started/route-handlers, file-conventions/route, file-conventions/proxy, functions/after, file-conventions/instrumentation, guides/authentication; `nextjs.org/blog/cve-2025-29927`.
- **08** components: image, font, script; getting-started/metadata-and-og-images; functions/generate-metadata; file-conventions/metadata/*; guides/upgrading/version-16#nextimage-changes.
- **09** config: output, adapterPath, deploymentId; guides: self-hosting, static-exports, deploying-to-platforms; route-segment-config/runtime; `nextjs.org/docs/messages/edge-runtime-deprecated`; guides/environment-variables.
- **10** `nextjs.org/docs/pages/building-your-application/…`: data-fetching/get-static-props, get-server-side-props, get-static-paths; routing/custom-app, routing/custom-document. `nextjs.org/docs/app/guides/migrating/app-router-migration`.

## 5. Hands-on verification
Every claim about what Next.js *does* runs in a scratch app in the scratchpad (never in the repo): `npx create-next-app@16.4.5`, one app per chapter, with and without `cacheComponents: true` + `partialPrefetching: true` where the answer differs. Record in each question: Next.js 16.4.5, React 19.3.x, Node 24.19.0, and for browser claims Chrome 156 and Firefox 159 (installed today), driven by puppeteer-core as in PLAN Phase 7. Always test `next build && next start`, never only `next dev` (no prefetching in dev; HMR cache hides fresh fetches).

Traps to run, not reason about:
- **02** The route table `next build` prints (static, partial, dynamic markers and their legend) for a page reading `cookies()`, `searchParams`, `connection()`, `Math.random()`, `Date.now()`; with Cache Components on, which of these fail the build ("uncached data outside Suspense") versus stream.
- **03** Which argument types make `use cache` fail at build or fall back; whether a cached function's closure over a component prop joins the key; whether cached output survives `next start` restarts (in-memory default) and a second instance.
- **04** `fetch` with no options under 16.4 with Cache Components off: fetched once at build when the route is static, per request once a request-time API appears (docs: "auto no cache"). GET route handler caching. Both against the docs' wording.
- **05** `revalidateTag('x')` with one argument: a TypeScript error or a runtime warning? `updateTag` called from a route handler: what throws? Two `next start` instances sharing nothing: is a revalidation seen by the other (expected: no, without a shared `cacheHandler`)? Server Action request headers (`Next-Action`) and the response payload type, from the Network panel.
- **06** Count prefetch requests on a page of 20 links with partial prefetching on and off; whether `staleTimes.static` default (5 min) applies to `<Link prefetch>`; back-navigation state retained with Cache Components on (an input's value) in both browsers; `redirect()` inside `try` swallowed.
- **07** `proxy.ts` with `export const runtime = 'edge'` throws (docs say so; record the message); matcher excluding `_next/static` and whether Server Action POSTs pass through Proxy; a request with `x-middleware-subrequest` on 16.4.5 is ignored (CVE-2025-29927 fix).
- **08** `next/image` output `srcset` and `sizes` for a `fill` image without `sizes`; that `next/font` serves the font from the app origin and emits a fallback with `size-adjust`.
- **09** `output: 'standalone'` folder contents and size; `output: 'export'` build errors for a route handler using `request`, for `cookies()`, for Image default loader; `NEXT_PUBLIC_X` inlined in a client chunk (grep `.next/static`).
- **10** A `<Link>` from an `app/` route to a `pages/` route causes a full document load (Network panel: document request).
- Security posts dated November 2026 (`november-2026-security-release`) are read before chapters 05 and 07 are written; any advisory cited goes in `perishable`.

## 6. How examples are shown
`examples:check` runs only `content/javascript` (js) and `content/typescript` (ts) (`app/scripts/examples.ts`), and the planned in-browser runner (PLAN 6.13) runs single-file code in a Web Worker. A Next.js app needs a file tree, a build and a server, so no nextjs example runs in CI or the browser. Instead:
- Code is `jsx`/`js` (writing rule: TypeScript only in typed topics), as the React topic does. A TypeScript-only API (route type helpers) may use `tsx` where the type is the point.
- A block that spans files starts each file with a path comment at column 0 (`// app/blog/[slug]/page.jsx`), the shape the `files` meta uses, so a later runner can adopt it. The template's limits hold: one Example block, ≤ 30 lines.
- No `// →` lines on code that only runs inside Next.js. Observed results go in prose ("`next build` marks this route Partial") or in a `text` block copied from the real run (build route table, `curl -I` headers), trimmed but never edited.
- Each example is run in the scratch app before it is written down; the question says which version it ran on (Section 5).

## 7. Open questions for the maintainer
1. **Which caching model leads?** Cache Components is opt-in in 16 but the docs teach it first and say it becomes default in the next major. *Recommendation:* as above: chapter 03 Cache Components, chapter 04 the default model, not marked `legacy` until 17 ships.
2. **Pages Router depth.** *Recommendation:* one 4-question chapter aimed at migration and legacy codebases; no Pages-only data-fetching chapter.
3. **Security questions (05/040, 07/030).** They overlap Web security and Authentication, which have no chapters yet. *Recommendation:* keep them here, scoped to the Next-specific mechanism (public action endpoints, Proxy bypass), and move the general CSRF and session parts to those topics later.
4. **Topic size.** 50 questions is close to React's 54. *Recommendation:* keep 50; if the maintainer wants it smaller, drop 01/060, 07/050, 08/040 and 10/040 first (lowest frequency).
