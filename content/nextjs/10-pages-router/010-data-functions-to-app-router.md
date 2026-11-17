---
title: "How do `getStaticProps`, `getServerSideProps` and `getStaticPaths` map to App Router code?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [pages-router, get-static-props, get-server-side-props, get-static-paths, migration, fallback]
related:
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/rendering/async-request-apis
  - nextjs/previous-caching/segment-config-options
  - nextjs/navigation/redirect-and-notfound-control-flow
verified: 2026-11
perishable:
  - "fetch with no options is uncached since Next.js 15"
  - "Pages Router getStaticProps routes print ● in the 16.4.5 route table"
sources:
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-6-migrating-data-fetching-methods
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#replacing-fallback
  - https://nextjs.org/docs/pages/api-reference/functions/get-static-paths#fallback-true
  - https://nextjs.org/docs/pages/api-reference/functions/get-static-props#revalidate
  - https://nextjs.org/docs/pages/api-reference/functions/get-server-side-props#notfound
  - https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-props#statically-generates-both-html-and-json
tldr: >
  None maps one to one: data moves into async Server Components and the route's mode follows what
  they read. `getStaticProps` becomes a fetch in a prerendered page (`revalidate` becomes a segment or
  `fetch` option); `getServerSideProps` becomes a request API like `headers()`; `getStaticPaths`
  becomes `generateStaticParams`, with `dynamicParams` replacing `fallback`. Nothing replaces
  `fallback: true`'s instant skeleton without Cache Components.
---

## Answer

In `pages/`, one exported function per page fetches data and passes it as props. In `app/`, any async Server Component fetches what it needs, and Next.js infers the route's rendering mode from what the tree reads (the static-or-dynamic question). On Next.js 16.4.5, Cache Components off:

- **`getStaticProps`** becomes data access in a Server Component; the page is still prerendered at build. `revalidate: 60` becomes `export const revalidate = 60` or `fetch(url, { next: { revalidate: 60 } })`. Both versions sent `s-maxage=60, stale-while-revalidate=31535940`.
- **`getServerSideProps`** becomes a component that reads the request: `await headers()`, `cookies()` or `searchParams` instead of `req`. That read makes the route `ƒ`, not the fetch. A `fetch` with no options isn't stored in the Data Cache, yet its route built as `○`, with the value frozen at build.
- **`getStaticPaths`** becomes `generateStaticParams`, returning `[{ id: '1' }]` instead of `{ paths, fallback }`. `dynamicParams = false` matches `fallback: false` (404). `true`, the default, behaves like `fallback: 'blocking'`: the first request renders the whole page, then it is cached.
- **`fallback: true`** has no direct equivalent. Pages serves a skeleton at once with `router.isFallback`, then fetches the props as JSON. In `app/`, a `loading.js` never showed on that first document request. With Cache Components on, the App Shell fills the role.
- **`{ notFound: true }` and `{ redirect }`** become `notFound()` and `redirect()` calls, which throw rather than return. Both gave 404 and 307 as before.

Props go away too: each component fetches its own data instead of receiving it from one function per page.

The migration guide's own comments disagree on the `fetch` default (one says `force-cache`, one says uncached). The 16.4.5 build above is the tiebreaker: uncached data, prerendered route.

## Example

```text
$ next build                     # Next.js 16.4.5, Cache Components off (excerpt)
Route (app)                Revalidate  Expire
├ ○ /a/fetch-plain                          fetch(url), no options
├   /a/gsp/[id]
│ └ ● /a/gsp/1                              generateStaticParams
├ ○ /a/isr                    1m      1y    export const revalidate = 60
└ ƒ /a/ssr                                  await headers()
Route (pages)              Revalidate  Expire
├   /p/fb-true/[id] (389 ms)
│ └ ● /p/fb-true/1 (340 ms)                 getStaticPaths, fallback: true
├ ● /p/isr (341 ms)           1m      1y    getStaticProps + revalidate: 60
└ ƒ /p/ssr                                  getServerSideProps

First document request for an unlisted id (the data takes 300 ms):
fallback: false            404     2 ms
dynamicParams = false      404     2 ms
fallback: 'blocking'       200   310 ms   full HTML, then x-nextjs-cache: HIT
dynamicParams = true       200   330 ms   full HTML, then HIT; loading.js not shown
fallback: true             200     8 ms   LOADING-FALLBACK, then
                                          GET /_next/data/<buildId>/p/fb-true/20.json
```

The right-hand notes describe each file; the build printed only the tables. Chrome 156 and Firefox 159 both showed `LOADING-FALLBACK` and then the item for `fallback: true`, and only the finished page in every other case.

## Pitfalls

- Reading "uncached by default" as "dynamic". `/a/fetch-plain` built `○` and kept its build-time value; the route turns dynamic only on a request read or `cache: 'no-store'`.
- `fallback: true` hiding 404s. For an id whose `getStaticProps` returned `notFound`, the document was a `200` fallback; the JSON request got `404` and the 404 page rendered client-side.
- Expecting `loading.js` to replace the fallback. On the first document request for `/a/gsp-loading/22`, the response arrived after 362 ms (Chrome 156) with the finished page and no loading UI.
- Assuming `notFound()` keeps `getServerSideProps` semantics. In a static page the 404 was prerendered and sent with `s-maxage=31536000`; `{ notFound: true }` from `getServerSideProps` was rendered per request with `no-store`.

## Follow-ups

**Q:** What replaces the `/_next/data/…json` requests?
**A:** The RSC payload. A `<Link>` to a Pages route fetched `/_next/data/<buildId>/p/fb-true/14.json`; one to an App route fetched `/a/gsp-loading/13?_rsc=…`. Per the docs, `getStaticProps` writes that JSON at build alongside the HTML.

**Q:** Does a client-side navigation show the `fallback: true` skeleton?
**A:** No. The docs say a `next/link` navigation behaves as `'blocking'`; measured, the page went straight from the old content to the item after the JSON arrived.

**Q:** Does Googlebot get the fallback?
**A:** No. With `User-Agent: Googlebot/2.1` the first request waited 317 ms and returned the full page (`MISS`), as the docs say crawlers are served `'blocking'`.
