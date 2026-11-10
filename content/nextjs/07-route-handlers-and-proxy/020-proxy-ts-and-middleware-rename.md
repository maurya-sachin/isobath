---
title: "What is `proxy.ts`, what should run there, and why was `middleware` renamed?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [proxy, middleware, matcher, rewrites, redirects, request-headers]
related:
  - nextjs/route-handlers-and-proxy/proxy-not-enough-for-auth
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - nextjs/route-handlers-and-proxy/instrumentation-and-request-errors
  - nextjs/navigation/prefetch-and-partial-prefetching
  - nextjs/deployment/edge-runtime-deprecation
  - nextjs/deployment/next-build-output
verified: 2026-11
perishable:
  - "Proxy runs only on Node.js; a `runtime` export fails the build (16.x)"
  - "`middleware.js` still builds, warns and runs on Edge (16.4.5)"
  - "Flight headers and `_rsc` hidden from Proxy (16.4.5)"
sources:
  - https://nextjs.org/docs/app/getting-started/proxy#use-cases
  - https://nextjs.org/docs/app/getting-started/proxy#limitations
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#matcher
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#execution-order
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#runtime
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#setting-headers
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#rsc-requests-and-rewrites
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#migration-to-proxy
  - https://nextjs.org/docs/app/guides/upgrading/version-16#middleware-to-proxy
  - https://nextjs.org/docs/messages/middleware-to-proxy
  - https://github.com/vercel/next.js/pull/84119
tldr: >
  One root file whose function runs before routing for every request its `matcher` allows. It can
  redirect, rewrite, set request or response headers and cookies, or answer directly. Keep it to
  fast decisions from the request itself. Next.js 16 renamed it because "middleware" suggested
  Express-style app logic; "proxy" says it's a layer in front of the app, on Node.js only.
---

## Answer

`proxy.js` (or `.ts`) sits beside `app/` and exports a function named `proxy` (or a default export) plus an optional `config.matcher`. For each matching request it gets a `NextRequest` and can:

- `NextResponse.redirect()` or `rewrite()` to another URL,
- `NextResponse.next({ request: { headers } })` to pass request headers on to the route,
- set response headers and cookies,
- return its own `Response`.

It runs after `next.config` `headers` and `redirects` and before every rewrite and the filesystem. On Next.js 16.4.5 (`next start`), a config redirect for `/old` answered `307` without Proxy running; for a `beforeFiles` rewrite of `/bf` to `/dash`, Proxy saw `/bf`.

What belongs there: decisions from the request alone. A/B or locale rewrites, redirects that depend on a cookie or header, adding headers, and the optimistic "no session cookie, go to `/login`" check. Static redirects belong in `next.config`'s `redirects`. Database calls don't belong in Proxy: it runs on every matched request, including prefetches.

What it can't do: per the docs (not run here), `use cache` and `fetch` caching options have no effect there. It also shares no module state with routes: a counter imported by both was incremented in Proxy and read `0` in a route handler.

**The rename (16.0).** The docs give two reasons: "middleware" was confused with Express middleware, inviting app logic into a feature meant as a last resort, and "proxy" names what it is, a network boundary in front of the app that may be deployed apart from it. 16 also made Proxy Node.js only. A `middleware.js` still built on 16.4.5, with a deprecation warning, and ran on the Edge runtime. The codemod is `npx @next/codemod@canary middleware-to-proxy .`.

## Example

```js
// proxy.js
import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/pricing') {
    const bucket = request.cookies.get('ab')?.value ?? (Math.random() < 0.5 ? 'a' : 'b');
    const res = NextResponse.rewrite(new URL(`/pricing/${bucket}`, request.url));
    res.cookies.set('ab', bucket);
    return res;
  }

  const headers = new Headers(request.headers);
  headers.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`GET /pricing` without a cookie rendered `app/pricing/a/page.jsx` at the URL `/pricing` and set `ab=a`; with `Cookie: ab=b` it rendered variant B. A page calling `(await headers()).get('x-pathname')` printed `/where`. Requests for `_next/static` chunks never reached Proxy; `/robots.txt` from `public/` did.

## Pitfalls

- Shipping without a matcher. Proxy then ran for every JavaScript chunk, `public/` file and `/_next/image` request: one page load logged seven chunk requests.
- Writing `NextResponse.next({ headers })` instead of `{ request: { headers } }`. With a copy of the request headers, the response echoed the client's `Cookie` and `Authorization` back to it.
- Keeping `export const runtime = 'edge'` after renaming. The build failed: "Route segment config is not allowed in Proxy file at "./proxy.js". Proxy always runs on Node.js runtime."
- Leaving both files in place. The build failed: "Both middleware file "./middleware.js" and proxy file "./proxy.js" are detected."

## Follow-ups

**Q:** Does Proxy run for prefetches and Server Action calls?
**A:** Yes. Chrome 156's `<Link>` prefetches of `/dash` and the action `POST /` both went through it. The `rsc` and `next-router-prefetch` headers and the `_rsc` query were hidden from `request`, so Proxy can't treat a prefetch differently by mistake; `next-action` was visible.

**Q:** Which runtime does it get?
**A:** Node.js: `process.env.NEXT_RUNTIME` was `nodejs`, `process.version` `v24.19.0`, and `require` and `Buffer` existed. The same code as `middleware.js` logged `NEXT_RUNTIME=edge`.

**Q:** Why not just use `next.config` for everything?
**A:** Config `headers`, `redirects` and `rewrites` are static rules: a path pattern plus, per the docs (not run here), `has`/`missing` conditions on headers, cookies or query. Proxy is code: it can compute a bucket, read a signed cookie or call a fast service.
