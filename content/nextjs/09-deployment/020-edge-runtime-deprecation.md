---
title: "Why is the Edge Runtime deprecated, and what did it trade away?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [edge-runtime, nodejs-runtime, route-segment-config, proxy, deprecation]
related:
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/deployment/next-build-output
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/cache-components/use-cache-keys
verified: 2026-11
perishable:
  - "runtime = 'edge' deprecated since 16.3 (PR #93369); no removal date"
  - "Edge routes still build and run on 16.4.5, with a warning"
  - "middleware.js still runs on Edge in 16.4.5, deprecated"
sources:
  - https://nextjs.org/docs/messages/edge-runtime-deprecated
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/runtime
  - https://nextjs.org/docs/app/api-reference/edge#caveats
  - https://nextjs.org/docs/app/api-reference/edge#unsupported-apis
  - https://nextjs.org/docs/app/guides/migrating-to-cache-components#runtime--edge
  - https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy
  - https://github.com/vercel/next.js/pull/93369
  - https://nextjs.org/docs/14/app/building-your-application/rendering/edge-and-nodejs-runtimes#edge-runtime
  - https://nextjs.org/blog/next-16#proxyts-formerly-middlewarets
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/build/warn-about-edge-runtime.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/server/web/sandbox/context.ts
tldr: >
  Next.js 16.3 deprecated `runtime = 'edge'` in favour of Node.js, the default; the PR gives no
  fuller reason and no removal date is stated. Edge traded Node APIs (`fs`, `node:crypto`), static
  generation and ISR for a small, web-API-only sandbox. Proxy and Cache Components are Node-only,
  so new features no longer target it.
---

## Answer

The Edge Runtime is a sandbox with web APIs only: `fetch`, `Request`/`Response`, streams, `crypto.subtle`, `TextEncoder`, plus an `AsyncLocalStorage` polyfill. It was designed to start fast close to users. You opted a page, layout or route handler into it with `export const runtime = 'edge'`.

**The deprecation.** It landed in v16.3.0 (PR #93369; v16.2.0 doesn't contain it). The PR's whole rationale is that Edge "is being deprecated in favor of the Node.js runtime (the default)", and the message page says to delete the export, since "no replacement is needed". Neither names a removal version. What the docs show is that new work targets Node.js: Proxy runs only on Node.js since 16, and Cache Components rejects any `runtime` export.

**What it traded away**, measured on Next.js 16.4.5 (`next build && next start`):

- **Node.js APIs.** `import { readFileSync } from 'node:fs'` or `createHash` from `node:crypto` failed the build: `Native module not found: node:fs`. `process.version` was `undefined`, and `new Function()` threw `EvalError: Code generation from strings disallowed for this context`.
- **Static generation and ISR.** The build warned `Using edge runtime on a page currently disables static generation for that page`. A page with `revalidate = 60` was listed as `ƒ` and rendered anew on every request, with no `Cache-Control` header at all.
- **Packages** that need Node built-ins or `require` at runtime.

What still works: edge routes build with a warning and run. `next start` runs them inside a `vm` sandbox in its own Node process, so `NEXT_RUNTIME` was `edge`.

## Example

```js
// app/api/e/route.js — copied to app/api/n/route.js without the runtime line
export const runtime = 'edge';

export async function GET() {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('x'));
  return Response.json({
    runtime: process.env.NEXT_RUNTIME,
    version: typeof process.version,
    secret: process.env.SECRET ?? null,
    sha: new Uint8Array(hash)[0].toString(16),
  });
}

// next build
// ⚠ The Edge Runtime is deprecated. You can use the "nodejs" runtime instead.
//   Learn more: https://nextjs.org/docs/messages/edge-runtime-deprecated
// ├ ƒ /api/e
// ├ ƒ /api/n

// SECRET=s3 next start
// GET /api/e → {"runtime":"edge","version":"undefined","secret":"s3","sha":"2d"}
// GET /api/n → {"runtime":"nodejs","version":"string","secret":"s3","sha":"2d"}
```

Migrating is deleting the first line: web APIs such as `crypto.subtle` work the same on Node.js, which adds `node:*` modules and caching.

## Pitfalls

- Moving an edge `runtime` export into `proxy.js`. The build failed: `Route segment config is not allowed in Proxy file at "./proxy.js". Proxy always runs on Node.js runtime.` Proxy logged `NEXT_RUNTIME=nodejs`; a `middleware.js` with the same code logged `edge`.
- Turning on Cache Components with edge routes left in. Each failed the build: `` Route segment config "runtime" is not compatible with `nextConfig.cacheComponents`. Please remove it. ``
- Treating local `next start` as proof that code runs on a real edge platform. With Turbopack, `require('fs')` inside an edge handler built silently and worked in the local sandbox; with `--webpack` the build warned `Can't resolve 'fs'` and the call threw `Cannot find module 'fs'`.
- Expecting `revalidate` to cache an edge page. It was ignored; every request rendered.

## Follow-ups

**Q:** Does `middleware.js` trigger the Edge deprecation warning?
**A:** Not on its own. A build with only `middleware.js` printed `The "middleware" file convention is deprecated. Please use "proxy" instead.` The 16.0 release post says middleware stays for Edge use cases but will be removed in a future version.

**Q:** Is `preferredRegion` affected?
**A:** Yes. PR #93369 deprecated it in the same change, because it only applied to Edge routes; it has its own message page and build warning.

**Q:** Why did Edge routes ever exist, then?
**A:** The Next.js 14 docs pitched it for "dynamic, personalized content at low latency with small, simple functions", starting faster than Node.js functions on platforms that deploy each route separately. Self-hosted there was no such gain: the handler ran in a sandbox inside the same Node process.
