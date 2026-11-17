---
title: "What did `_app` and `_document` do, and what replaces them?"
status: draft
difficulty: easy
frequency: 2
core: false
tags: [pages-router, custom-app, custom-document, root-layout, web-vitals, migration]
related:
  - nextjs/pages-router/pages-and-app-coexistence
  - nextjs/pages-router/moving-page-to-app
  - nextjs/app-router/app-router-component-tree
  - nextjs/app-router/layout-state-and-template
  - nextjs/optimizations/generate-metadata-streaming-dedup
verified: 2026-11
perishable:
  - "Missing <html> in root layout errors only in next dev (16.4.5)"
  - "reportWebVitals export in _app still read by Next.js 16.4.5"
sources:
  - https://nextjs.org/docs/pages/building-your-application/routing/custom-app#getinitialprops-with-app
  - https://nextjs.org/docs/pages/building-your-application/routing/custom-document#caveats
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-2-creating-a-root-layout
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#migrating-_documentjs-and-_appjs
  - https://nextjs.org/docs/app/api-reference/functions/use-report-web-vitals
  - https://nextjs.org/docs/messages/missing-root-layout-tags
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/client/index.tsx
tldr: >
  `_app` wrapped every page, on the server and again in the browser on each navigation: global CSS,
  providers, a persistent layout. `_document` rendered the `<html>` shell on the server only. One
  root `app/layout.js`, a Server Component that must render `<html>` and `<body>`, replaces both;
  providers move into a Client Component it renders, `<head>` tags into metadata.
---

## Answer

In the Pages Router, two special files sit around every page:

- **`pages/_app.js`** is the component that renders each page (`<Component {...pageProps} />`). It's where global CSS is imported and where context providers and a shared layout live, so their state survives client navigations. On Next.js 16.4.5 it ran on the server for each document and in the browser on hydration and on every `<Link>` navigation. A navigation to a `getServerSideProps` page ran only that function on the server; `_app` re-rendered in the browser.
- **`pages/_document.js`** shapes the HTML document: `<Html>`, `<Head>`, `<Main>` and `<NextScript>`, all four required. The docs say it renders only on the server, so no event handlers, no data fetching, and components outside `<Main>` are never initialized in the browser. Its `<Head>` is for tags common to every page, not `next/head`.

The App Router replaces both with **one root layout**, `app/layout.js`. It must render `<html>` and `<body>` itself. It's a Server Component: global CSS is imported there, attributes go straight on `<html>`, and `<head>` content comes from the Metadata API. Providers that need state or context move into a `'use client'` component that the layout renders. The layout ran only on the server: a navigation to a dynamic page re-rendered that page on the server, and the root layout didn't run again.

Two more things map across. `export function reportWebVitals` in `_app` becomes `useReportWebVitals` from `next/web-vitals`, called in a Client Component. And `_app` data loading has no direct replacement: `App.getInitialProps` ran for every page and switched off static optimization (`○` became `ƒ`); in `app/`, each layout fetches its own data.

The guide says to keep `_app` and `_document` until every page has left `pages/`, because the root layout doesn't apply there.

## Example

```jsx
// pages/_document.js: server-only HTML shell for pages/
import { Html, Head, Main, NextScript } from 'next/document';
export default function Document() {
  return (
    <Html lang="en" className="doc">
      <Head><link rel="icon" href="/favicon.svg" /></Head>
      <body data-from="document"><Main /><NextScript /></body>
    </Html>
  );
}

// pages/_app.js: wraps every page, server and browser
export function reportWebVitals(metric) { console.log(metric.name); }
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}

// app/layout.js: replaces both for app/
import Vitals from '../components/Vitals'; // 'use client', calls useReportWebVitals
export default function RootLayout({ children }) {
  return <html lang="en"><body><Vitals />{children}</body></html>;
}
```

Chrome 156 and Firefox 159 logged `_app` in the browser on load and on each navigation, and never `_document` or the root layout. The `_app` callback received Next.js's own metrics (`Next.js-hydration`, `Next.js-render`, `Next.js-route-change-to-render`); the hook received web vitals such as `FCP` and `TTFB`.

## Pitfalls

- Adding `getInitialProps` to `_app` for one page's needs. The build printed ``Warning: You have opted-out of Automatic Static Optimization due to `getInitialProps` in `pages/_app` `` and every page without `getStaticProps` turned `ƒ`.
- Relying on the build to check the root layout. A layout returning `<main>{children}</main>` built cleanly and `next start` sent a document with no `<html>` or `<body>`. Only `next dev` showed `Missing <html> and <body> tags in the root layout.`
- Making the root layout `'use client'` to keep a provider. Wrap only the provider, so the layout and everything else stays on the server.
- Passing an inline callback to `useReportWebVitals`. The docs say each new function receives the metrics so far; with an inline arrow, Chrome 156 reported `FCP` again after each navigation.

## Follow-ups

**Q:** Where does a per-page layout (`getLayout`) go?
**A:** Into nested `layout.js` files. The migration guide replaces the `getLayout` pattern with nested layouts, which stay mounted for every route below them.

**Q:** What replaced `_error.js` and `404.js`?
**A:** The guide maps them to `error.js` files per segment and `not-found.js`.

**Q:** Can the root layout read the request like `_document`'s `getInitialProps`?
**A:** It can call `cookies()` or `headers()`, but without Cache Components that makes every route under it dynamic. Read request data as low in the tree as possible.
