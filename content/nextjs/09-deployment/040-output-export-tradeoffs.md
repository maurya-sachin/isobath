---
title: "What does `output: 'export'` give up?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [static-export, output-export, next-build, self-hosting, spa]
related:
  - nextjs/deployment/next-build-output
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/optimizations/next-image-responsibilities
verified: 2026-11
perishable:
  - "next/image default loader not rejected at build (16.4.5)"
  - "Omitted dynamicParams builds; explicit true fails (16.4.5)"
  - "Proxy file builds with a warning and never runs"
sources:
  - https://nextjs.org/docs/app/guides/static-exports#configuration
  - https://nextjs.org/docs/app/guides/static-exports#unsupported-features
  - https://nextjs.org/docs/app/guides/static-exports#image-optimization
  - https://nextjs.org/docs/app/guides/static-exports#route-handlers
  - https://nextjs.org/docs/app/guides/static-exports#deploying
  - https://nextjs.org/docs/messages/export-no-custom-routes
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/export/index.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/build/index.ts
tldr: >
  Everything that needs a server at request time. `next build` writes HTML, RSC payload `.txt` files
  and assets to `out/` for any static host. Request APIs, Server Actions, non-static route handlers
  and paths missing from `generateStaticParams` fail the build. Config rewrites, redirects and headers,
  ISR, Proxy and the image optimizer only warn, or are silently dropped.
---

## Answer

`output: 'export'` makes `next build` write a self-contained static site to `out/`: one `.html` per path, the RSC payloads as `.txt` files (so client navigation still works), `_next/static/`, `public/` and `404.html`. No Next.js server runs afterwards. On 16.4.5, `next start` refuses: `"next start" does not work with "output: export" configuration. Use "npx serve@latest out" instead.`

What you keep: Server Components rendered at build, Client Components, `<Link>` navigation and prefetching, `generateStaticParams` paths, and `GET` route handlers marked `force-static` (they become files such as `data.json`).

What you give up is anything decided per request. On Next.js 16.4.5 I added one feature at a time:

- **The build fails** for `cookies()` or `headers()` (``Route /c with `dynamic = "error"` couldn't be rendered statically because it used `cookies()` ``), a route handler without `force-static`, even one ignoring `Request`, a dynamic segment without `generateStaticParams`, an explicit `dynamicParams = true`, and Server Actions (`Server Actions are not supported with static export.`).
- **The build warns and drops it** for `rewrites`, `redirects` and `headers` in config (`Specified "rewrites" will not automatically work with "output: export".`) and for a Proxy file, whose warning still names `next export` and middleware.
- **Silent**: `revalidate = 60` built as `○ /isr 1m 1y`, but nothing will ever regenerate the file. `next/image` with the default loader built cleanly and wrote `srcset` URLs to `/_next/image`, which doesn't exist in `out/`. Set `images.unoptimized: true` (plain `src="/hero.jpg"`) or a custom loader.

So a static export is a fit for docs, marketing sites and SPAs whose dynamic data comes from client-side fetches to some other API. Redirects, headers and auth move to the host or CDN.

## Example

```text
next.config.mjs: export default { output: 'export' }   — Next.js 16.4.5, Turbopack

feature added                        build   output
rewrites / redirects / headers       ok      ⚠ … are not applied when exporting your application
cookies() / headers() in a page      fails   Route /c with `dynamic = "error"` couldn't be rendered…
route handler, no force-static       fails   export const dynamic = "force-static"/export const
                                             revalidate not configured on route "/api/q" …
export const revalidate = 60         ok      ○ /isr 1m 1y, never regenerated
<Image src="/hero.jpg"> default      ok      srcset → /_next/image?url=%2Fhero.jpg&w=640&q=75
dynamicParams omitted                ok      /blog/c → host's 404
export const dynamicParams = true    fails   "dynamicParams: true" cannot be used with
                                             "output: export".
[id] without generateStaticParams    fails   Page "/u/[id]" is missing "generateStaticParams()" …
inline 'use server' action           fails   Server Actions are not supported with static export.
proxy.js                             ok      ⚠ Statically exporting … disables API routes and
                                             middleware.  (ƒ Proxy listed, never runs)
```

Served from `out/` by a plain Node file server, Chrome 156 and Firefox 159 both navigated from `/` to `/blog/a` without a reload, fetching `blog/a/__next._tree.txt` and the page's segment `.txt`. The image request got `404`, `naturalWidth` `0`.

## Pitfalls

- Trusting a green build. ISR, the image optimizer, config redirects and Proxy all built and then did nothing.
- Leaving `dynamicParams` out and expecting a build error for unknown paths. Only an explicit `true` fails; omitted, unlisted `/blog/c` was simply the host's 404.
- Assuming a `GET` route handler is static because it ignores the request. Without `export const dynamic = 'force-static'` the build failed.
- Uploading `out/` to a host that serves only exact file names. `/blog/a` exists as `blog/a.html`; the docs' nginx example uses `try_files $uri $uri.html $uri/ =404`.

## Follow-ups

**Q:** Why does the image check exist in the source but not fire?
**A:** `export/index.ts` throws the default-loader error only if `.next/export-marker.json` says `isNextImageImported: true`. In 16.4.5's `build/index.ts` that flag is collected only for Pages Router pages, so an App Router `<Image>` left it `false` under Turbopack and `--webpack`.

**Q:** How is this different from a fully `○` app under `next start`?
**A:** The files are the same kind, but `next start` still serves RSC variants by header, runs actions and the image optimizer, applies config rules and can revalidate. A static host only maps URLs to files.

**Q:** Can a static export still read cookies?
**A:** Only in the browser, in a Client Component after hydration. Nothing reads the request before the HTML is sent.
