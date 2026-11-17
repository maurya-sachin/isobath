---
title: "What changes about data, layouts and client JavaScript when a page moves to `app/`?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [pages-router, migration, server-components, client-javascript, layouts, next-router]
related:
  - nextjs/pages-router/data-functions-to-app-router
  - nextjs/rendering/client-boundary-placement
  - nextjs/app-router/layout-state-and-template
  - nextjs/optimizations/generate-metadata-streaming-dedup
  - nextjs/pages-router/app-and-document-replacements
verified: 2026-11
perishable:
  - "next build on 16.4.5 prints no per-route JS size column"
  - "Measured chunk sizes are for Next.js 16.4.5 with Turbopack"
sources:
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-4-migrating-pages
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-5-migrating-routing-hooks
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-3-migrating-nexthead
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#migrating-the-getlayout-pattern-to-layouts-optional
  - https://nextjs.org/docs/pages/building-your-application/routing/pages-and-layouts#per-page-layouts
  - https://nextjs.org/docs/messages/next-router-not-mounted#why-this-error-occurred
tldr: >
  The page becomes a Server Component: it fetches its own data, and only `'use client'` modules ship
  and hydrate, so server-only rendering code leaves the bundle while the App Router runtime itself is
  bigger. Nested layouts keep state across navigations, as `_app` did. `next/router` and `next/head`
  stop working: use `next/navigation` hooks and the Metadata API.
---

## Answer

**Data.** A Pages Router page receives props from `getStaticProps` or `getServerSideProps`. In `app/`, `page.js` is a Server Component by default and awaits its data itself (the data-functions question has the mapping).

**Client JavaScript.** The migration guide says it plainly: pages in `pages/` are Client Components. Every module a page imports ships to the browser and runs again during hydration, even one that only formats markup. In `app/`, a Server Component's code stays on the server; the browser gets its rendered output in the RSC payload, and only `'use client'` modules ship and hydrate. On Next.js 16.4.5 (Turbopack), the same product page, rendered with a 117 KB lookup table:

- `pages/`: 8 scripts, 154,824 bytes gzipped, 41,136 of them the chunk holding the table.
- `app/`: 7 scripts, 138,639 bytes, no table.

Without that chunk the Pages version would have been smaller: the App Router runtime costs more than the Pages runtime, and the HTML grew from 718 to 1,970 bytes gzipped because it carries the RSC payload. The saving comes from what you keep on the server. `next build` on 16.4.5 printed no per-route size column, so measure the HTML's script tags.

**Layouts.** `_app` wraps every page and keeps its state across client navigations; a layout component rendered inside each page remounts. A nested `layout.js` stays mounted for every route under it. Measured: a counter at 2 stayed at 2 in `app/a/layout.js`, and dropped to 0 in a per-page layout.

**Router and head.** `useRouter` from `next/router` doesn't work in `app/`; `next/navigation` has `useRouter`, `usePathname`, `useSearchParams` and `useParams`. `next/head` is replaced by the Metadata API.

## Example

```jsx
// components/Product.js: no directive (imports omitted below)
import { describe } from '../lib/heavy'; // 117 KB table
export default function Product({ ids }) {
  return <ul>{ids.map((id) => <li key={id}>{describe(id)}</li>)}</ul>;
}

// pages/p/product.js: Product ships and hydrates
export async function getStaticProps() { return { props: { ids: [1, 2, 3] } }; }
export default function Page({ ids }) {
  return <main><Product ids={ids} /><Counter label="cart" /></main>;
}

// app/a/product/page.js: Product runs only on the server
export default function Page() {
  return <main><Product ids={[1, 2, 3]} /><Counter label="cart" /></main>;
}

// app/a/product-client/page.js: 'use client' on the page ships it again
```

`Counter` is a `'use client'` button, so it ships in all three. Gzipped, excluding the `noModule` polyfill: `/p/product` 154,824 bytes, `/a/product` 138,639, `/a/product-client` 179,626 including a 40,987-byte table chunk. Chrome 156 and Firefox 159 transferred identical totals for the first two.

## Pitfalls

- Stopping at the migration guide's first step. Wrapping the old page in `'use client'` keeps its behaviour and its bundle: that version shipped more than the Pages page did.
- Using `next/head` in `app/`. A `<Head><title>` in a page built without a warning and rendered no `<title>`.
- Importing `useRouter` from `next/router` in a Client Component under `app/`. The build failed prerendering it: `Error: NextRouter was not mounted.`
- Expecting a per-page layout to keep state. Rendered inside each page component, it remounted on every `<Link>` navigation even though the document never reloaded.

## Follow-ups

**Q:** How do shared components work during the migration?
**A:** The docs offer `next/compat/router`: the Pages `useRouter` without the "not mounted" error, so one component can serve both routers until `pages/` is gone.

**Q:** Did `_app`'s state survive in `app/` routes?
**A:** `_app` doesn't apply there. The `app/` pages had no `_app` counter at all; its job moves to the root layout.

**Q:** Why is the RSC payload in the HTML?
**A:** React needs the Server Component output to hydrate the Client Components inside it without re-running server code. That's why `/a/product`'s HTML is larger: the list appears as markup and again as payload.
