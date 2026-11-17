---
title: "What does `next build` produce, and what runs where under `next start`?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [next-build, next-start, build-output, standalone, prerendering, self-hosting]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/previous-caching/default-cache-locations
  - nextjs/navigation/prefetch-and-partial-prefetching
  - nextjs/deployment/multi-instance-hosting
  - nextjs/deployment/output-export-tradeoffs
verified: 2026-11
perishable:
  - "Runtime route-cache folder under .next/server is new in 16.4"
  - "Turbopack default builder since Next.js 16; webpack via --webpack"
  - "Route table symbols: ○ ● ƒ, plus ◐ with Cache Components"
sources:
  - https://nextjs.org/docs/app/guides/building#reading-the-build-output
  - https://nextjs.org/docs/app/guides/building#with-cache-components
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/output#automatically-copying-traced-files
  - https://nextjs.org/docs/app/guides/self-hosting#automatic-caching
  - https://nextjs.org/docs/app/guides/self-hosting#configuring-caching
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/incremental-cache/file-system-cache.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/lib/route-cache-key.ts
tldr: >
  A `.next/` folder with three parts: `static/` (hashed client chunks, served as immutable files),
  `server/` (one server bundle per route plus prerendered `.html`, `.rsc` and segment files) and
  manifests that tie URLs to both. `next start` is a Node server that serves those files, renders
  `ƒ` routes, regenerates ISR pages and runs actions and the image optimizer.
---

## Answer

`next build` compiles, prerenders what it can and writes `.next/`. On Next.js 16.4.5 (Turbopack, the default builder) the parts that matter are:

- **`static/`**: client JavaScript and CSS with content hashes in their names (`static/chunks/0c1ad7rcpjghx.js`), plus a folder named after `BUILD_ID`. `next start` served a chunk with `Cache-Control: public, max-age=31536000, immutable`.
- **`server/app/`**: for each route a server bundle (`page.js` or `route.js`), and for each prerendered path its output: `index.html`, `index.rsc` (the RSC payload for client navigation), `index.meta` (headers and cache tags) and an `index.segments/` folder for per-segment prefetches. A static route handler becomes `.body` plus `.meta`.
- **Manifests**: `routes-manifest.json`, `prerender-manifest.json` (which paths are prerendered and their revalidate times), `required-server-files.json` and the rest that map a URL to a bundle or a file.
- **`cache/`**: the builder's own cache, reused by the next build.

The route table says which output each route got. `○` (Static) and `●` (SSG, from `generateStaticParams`) have files in `server/app`; `ƒ` (Dynamic) has only a bundle. With `cacheComponents: true`, `◐` (Partial Prerender) marks a route whose static shell is prerendered and whose holes render per request.

`next start` is a Node.js server over that folder. It answers `public/` and `static/` from disk, a prerendered page from its files (`x-nextjs-cache: HIT`), and renders `ƒ` routes per request. It also does what no file server can: picks HTML or RSC by request headers, regenerates ISR pages and renders unlisted dynamic params, runs Server Actions, route handlers, Proxy and the `/_next/image` optimizer.

`output: 'standalone'` adds `.next/standalone/`: a `server.js` and only the traced `node_modules`, 41 MB here against 328 MB installed. It doesn't copy `public/` or `.next/static/`.

## Example

```text
$ next build                         # Next.js 16.4.5 (Turbopack)
Route (app)       Revalidate  Expire
┌ ○ /
├ ○ /_not-found
├ ƒ /api/dyn
├ ○ /api/static
├   /blog/[slug]
│ ├ ● /blog/a
│ └ ● /blog/b
├ ƒ /dyn
└ ○ /isr                  1m      1y

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand

$ next start, then curl -I
/             x-nextjs-cache: HIT   Cache-Control: s-maxage=31536000
/isr          x-nextjs-cache: HIT   Cache-Control: s-maxage=60, stale-while-revalidate=31535940
/blog/c       x-nextjs-cache: MISS  Cache-Control: s-maxage=31536000
/dyn          Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
/api/static   x-nextjs-cache: HIT   cache-control: s-maxage=31536000
/robots.txt   Cache-Control: public, max-age=0
```

`/blog/c` wasn't listed by `generateStaticParams`, so the first request rendered it (`MISS`) and wrote it to disk; the second was a `HIT`. `/dyn` reads `cookies()` and has no files in `server/app`.

## Pitfalls

- Treating `.next/static` as the whole site. It holds only client assets; every page, payload and prerendered response lives in `.next/server`, and a plain file server can't choose between `isr.html` and the segment files a prefetch asks for.
- Editing files in `.next/server/app` on a live server. An edited `index.html` was never served: `next start` keeps entries in memory (50 MB by default) and, on the first request, copies each build file into its runtime cache folder.
- Running `next start` with `output: 'standalone'`. It printed `"next start" does not work with "output: standalone" configuration. Use "node .next/standalone/server.js" instead.`
- Deploying `.next/standalone` alone. Pages rendered, but every chunk and `public/` file was `404` until `public/` and `.next/static/` were copied in.

## Follow-ups

**Q:** What differs with `next build --webpack`?
**A:** The route table and the prerendered files were the same. Chunks got webpack names (`framework-…js`, `main-app-…js`, per-route `chunks/app/…`), `server/` gained `webpack-runtime.js`, and `.next/cache` was 70 MB against Turbopack's 24 MB.

**Q:** Why does `/` carry `s-maxage` but not `public`?
**A:** That was the header sent: `s-maxage=31536000`, which tells a shared cache it may store the page for a year. The self-hosting guide says fully static pages get `public`; 16.4.5 didn't send it.

**Q:** Is `BUILD_ID` just a label?
**A:** No. It names the `static/<BUILD_ID>/` folder and keys caches, so instances must share one build, or set `generateBuildId` and `deploymentId` (see the multi-instance question).

## Deep dive

### How it works

The build runs in phases: load `.env` files and config, discover routes, compile client and server code, classify each route as prerenderable or not, prerender, then write `.next/` and print the table. The classification is the static-or-dynamic decision; this question is about what it leaves on disk.

For the app in the example (Turbopack), the top level after `next build` was:

```text
.next/
  BUILD_ID                    C18dHG2iHAO1RznzkYR6U
  build-manifest.json  prerender-manifest.json  routes-manifest.json
  required-server-files.json  next-server.js.nft.json   (trace of the server's own files)
  static/        592 KB  chunks/*.js, C18dHG2iHAO1RznzkYR6U/_buildManifest.js
  server/        5.9 MB  app/, chunks/, pages/404.html, *-manifest.json
  cache/          24 MB  turbopack/
  diagnostics/  types/  trace
```

A prerendered path's `.meta` file holds what `next start` replays with the HTML:

```text
"x-nextjs-stale-time": "300",
"x-nextjs-prerender": "1",
"x-next-cache-tags": "_N_T_/layout,_N_T_/isr/layout,_N_T_/isr/page,_N_T_/isr"
"routeCache": { "key": "/route-cache/APP_PAGE/c38585ba…/$/isr", … }
```

The `routeCache.key` is new in 16.4. In the 16.4.5 source the files the build wrote are an immutable "build seed". On the first request for a path, the file-system cache copies the seed into `.next/server/route-cache/<kind>/<sha256 of the source route>/$<path>` and serves from there, and later regenerations write there too. Measured: right after `next start`, `route-cache/` didn't exist; after one `GET /` it held `index.html`, `.rsc`, `.meta` and three segment files. A page rendered at request time (`/blog/d`) was written only under `route-cache/`.

Requests then split three ways:

1. **Plain files.** `/_next/static/*` (immutable) and `public/` (`max-age=0` with an `ETag`). Nothing renders.
2. **Cached output.** `○`/`●` paths and static GET handlers. The server picks the variant from headers: a document request got `isr.html`; `RSC: 1` was redirected to `/isr?_rsc` and answered with `text/x-component`; Chrome 156's `<Link>` prefetch of `/isr` made two requests with `next-router-segment-prefetch: /_tree` and `/isr/__PAGE__`, matching the `.segments/` files. Every cached response says `Vary: rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch`.
3. **Rendering.** `ƒ` routes, ISR regeneration after `revalidate`, unlisted params, Server Actions (a `POST` to a page URL, even a static one), route handlers, Proxy and `/_next/image`.

Only the first group is free of Node.js. That is why a CDN in front can take groups 1 and 2 if it respects `Cache-Control` and the `Vary` list, while group 3 always reaches `next start`.

### Edge cases

- **The legend lists only symbols in use.** The cache-components build above printed `○` and `◐` and no `ƒ` line, because no route was fully dynamic.
- **`◐` routes get files too**: `ppr.html`, `ppr.meta` and `ppr.segments/` hold the shell, and only the holes render per request (the Partial Prerendering question covers the streaming).
- **Route handlers.** `ƒ /api/dyn` has only `route.js`; `○ /api/static` (`dynamic = 'force-static'`) has `static.body` and `static.meta` and was answered with `x-nextjs-cache: HIT` without running.
- **A rebuild wipes runtime output.** After a second `next build`, `.next/server/route-cache/` was gone, so pages generated at runtime are re-rendered on demand.

### Real-world scenario

A team builds an image with `output: 'standalone'`, copies only `.next/standalone` and starts `node server.js`. HTML loads, hydration never happens: every `/_next/static/chunks/*.js` is a `404`. The output docs say the minimal server leaves those folders out because a CDN should serve them. The fix is either to upload `.next/static` to the CDN under `/_next/static` (or set `assetPrefix`), or run `cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/` in the image build. After the copy, `server.js` served both (`200`).

### Trade-offs

Prerendering moves work from request time to build time and turns pages into files with long `s-maxage`, but the files are only half the story: RSC variants, segment prefetches and revalidation logic live in the server. `next start` keeps one process in charge of all of it with zero configuration, at the cost that its caches are per process and per disk. Standalone trims the deployment to what tracing found (`outputFileTracingIncludes` covers what it misses) without changing what runs.
