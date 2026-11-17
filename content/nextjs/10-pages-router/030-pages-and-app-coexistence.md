---
title: "Can `pages/` and `app/` coexist, and what isn't shared between them?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [pages-router, app-router, migration, coexistence, i18n, hard-navigation]
related:
  - nextjs/pages-router/moving-page-to-app
  - nextjs/pages-router/app-and-document-replacements
  - nextjs/app-router/route-groups-root-layouts
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/navigation/link-click-to-render
verified: 2026-11
perishable:
  - "Duplicate-route build error text differs between Turbopack and webpack"
  - "i18n config warning printed by next start in 16.4.5"
sources:
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#using-app-router-together-with-pages-router
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#migrating-_documentjs-and-_appjs
  - https://nextjs.org/docs/app/guides/migrating/app-router-migration#step-5-migrating-routing-hooks
  - https://nextjs.org/docs/pages/guides/internationalization#sub-path-routing
  - https://nextjs.org/docs/app/guides/internationalization#routing-overview
tldr: >
  Yes, page by page, but as two apps behind one server. Shared: the build, `public/`, environment
  variables, Proxy and `next.config` redirects and headers. Not shared: `_app`/`_document` versus the
  root layout, the client router (crossing routers is a full document load) and `i18n` routing, which
  is Pages-only. One URL can't exist in both; the build fails.
---

## Answer

The migration guide designs `app/` to run alongside `pages/` so a codebase can move one route at a time. On Next.js 16.4.5, one `next build` produced two route tables, `Route (app)` and `Route (pages)`, served by one `next start`.

**Shared**, measured on `/p` (a Pages route) and `/a` (an App route):
- `public/` files and `.env` values: both pages rendered `NEXT_PUBLIC_GREETING`.
- `next.config` `redirects` and `headers`: both redirects returned 307, and the custom header was on both responses.
- Proxy: its response header appeared on both routes its `matcher` listed.

**Not shared:**
- **The shell.** `_app` and `_document` wrap only `pages/`; the root layout wraps only `app/`. The guide says to keep `_app`/`_document` until the last page moves, and that styles in `app/layout` don't reach `pages/`.
- **The client router.** A `<Link>` between the two routers did a full document load in Chrome 156 and Firefox 159: a `window` marker was lost and `performance.getEntriesByType('navigation')` named the new URL. A `<Link>` within `pages/` kept the marker.
- **`i18n`.** It is a Pages Router option. With `locales: ['en', 'fr']`, `/fr/p` rendered the Pages route and `/fr/a` returned 404, and `next start` warned: `i18n configuration in next.config.mjs is unsupported in App Router.` The App Router does locales with an `app/[lang]` segment instead.
- **Routing hooks.** `next/router` works only in `pages/`, `next/navigation` only in `app/`.

A URL must belong to one router. With `pages/dup.js` and `app/dup/page.js`, the Turbopack build failed with `App Router and Pages Router both match path: /dup`. An unmatched URL got the App Router's 404 page.

## Example

```text
$ next build                     # Next.js 16.4.5 (Turbopack)
Error: App Router and Pages Router both match path: /dup
Next.js does not support having both App Router and Pages Router routes matching
the same path. Please remove one of the conflicting routes.

$ next build --webpack
⨯ Conflicting app and page file was found, please remove the conflicting files to continue:
⨯   "pages/dup.js" - "app/dup/page.js"

$ rm pages/dup.js && next build && next start, then curl
/p            200  <html lang="en" data-doc="pages">  "from _app"   x-proxy: /p
/a            200  <html lang="en">                                x-proxy: /a
/shared.txt   200  (public/)   x-config-header: 1
/nope         404  <html lang="en">  (App Router not-found)
```

`data-doc` is set in `pages/_document.js` and "from _app" rendered by `pages/_app.js`; neither reached `/a`. The `rm` also removed `app/dup/`.

## Pitfalls

- Expecting a shared header or provider from `_app` on new `app/` routes. Context providers, global CSS and analytics must be added to the root layout as well, for the length of the migration.
- Treating cross-router links as soft. Client state is lost and the second router's JavaScript downloads on arrival.
- Counting on prefetch across routers. Chrome 156 still requested `/_next/data/<buildId>/a.json` from the Pages page and `/p?_rsc=…` from the App page, and both came back as `text/html`: wasted bytes, no warm cache.
- Moving a localized page into `app/` while `i18n` is on. Its locale prefixes stopped working (`/fr/a` 404), so localized routes migrate together once `app/[lang]` exists.

## Follow-ups

**Q:** Does `/en/a` work with `defaultLocale: 'en'`?
**A:** Yes: it returned 200 with the App page. Only the non-default locale broke.

**Q:** Can the hard navigation be avoided?
**A:** It can be made faster, not soft: the guide links a Vercel guide on optimizing hard navigations between the routers. Migrating tightly linked routes together removes the crossing altogether.

**Q:** Are API routes affected?
**A:** The guide says `pages/api` keeps working unchanged. The same rule applies: `pages/api/x.js` plus `app/api/x/route.js` failed with `App Router and Pages Router both match path: /api/x`.
