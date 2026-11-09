---
title: "How does the App Router turn folders and special files into a component tree?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [app-router, file-conventions, layout, route-segments, colocation]
related:
  - nextjs/app-router/layout-state-and-template
  - nextjs/app-router/loading-error-not-found-boundaries
  - nextjs/app-router/parallel-routes-default
  - nextjs/app-router/route-groups-root-layouts
  - react/server-components/rsc-vs-ssr
verified: 2026-11
perishable:
  - "Component hierarchy order as documented for Next.js 16.4"
sources:
  - https://nextjs.org/docs/app/getting-started/project-structure#routing-files
  - https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy
  - https://nextjs.org/docs/app/getting-started/project-structure#colocation
  - https://nextjs.org/docs/app/getting-started/project-structure#private-folders
  - https://nextjs.org/docs/app/getting-started/layouts-and-pages#nesting-layouts
  - https://nextjs.org/docs/app/api-reference/file-conventions/layout#children-required
  - https://nextjs.org/docs/app/api-reference/file-conventions/layout#caveats
  - https://nextjs.org/docs/app/api-reference/file-conventions/template#convention
  - https://nextjs.org/docs/app/api-reference/file-conventions/loading#instant-loading-states
  - https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
  - https://nextjs.org/docs/app/api-reference/file-conventions/not-found#not-foundjs
tldr: >
  Each folder under `app/` is a route segment, and only a `page.js` or `route.js` makes it
  reachable. Inside a segment, Next.js nests the special files in a fixed order: `layout`,
  `template`, the `error` boundary, the `loading` Suspense boundary, the `not-found` boundary, then
  the `page` or the child segment. Child segments nest inside their parent's, so a URL becomes
  nested components.
---

## Answer

Every folder under `app/` is a **route segment**, mapped to one part of the URL. `[id]` makes a segment dynamic; `(group)` and `@slot` folders add no URL part; `_folder` opts a folder out of routing. A segment is reachable only once it holds a `page.js` (UI) or `route.js` (a handler). Anything else can be colocated safely: a component file next to a page isn't served.

Inside one segment the special files are rendered in a fixed order, outermost first:

1. `layout.js`
2. `template.js`
3. `error.js`, a React error boundary
4. `loading.js`, a `<Suspense>` boundary
5. `not-found.js`, a boundary for `notFound()`
6. `page.js`, or the next segment's layout

The tree is built recursively: a child segment's whole stack is rendered where the parent's page would be, so it sits inside the parent's layout, template and boundaries. A layout receives the child stack as `children`, plus `params` and, with parallel routes, one prop per slot.

Two consequences come straight from the order:

- A segment's `error.js` and `loading.js` sit **below** its own `layout.js`. They can't catch an error thrown by that layout or show a fallback while it loads; the parent segment's files do that, and the root layout needs `global-error.js`.
- The parent's boundaries **do** wrap the child segment's layout, so a parent `loading.js` covers a slow child layout.

Layouts and pages are Server Components by default; `error.js` must be a Client Component. The page is the only part that changes on every navigation within the segment: layouts persist and don't re-render, which is why they get no `searchParams`.

## Example

```jsx
// Files for /dashboard/settings:
// app/layout.jsx
// app/dashboard/layout.jsx, template.jsx, error.jsx, loading.jsx, not-found.jsx
// app/dashboard/settings/page.jsx
// app/dashboard/_ui/chart.jsx   (colocated, never routable)

// What Next.js renders for /dashboard/settings, simplified:
<RootLayout>
  <DashboardLayout>
    <DashboardTemplate key="dashboard">
      <ErrorBoundary fallback={<DashboardError />}>
        <Suspense fallback={<DashboardLoading />}>
          <NotFoundBoundary fallback={<DashboardNotFound />}>
            <SettingsPage />
          </NotFoundBoundary>
        </Suspense>
      </ErrorBoundary>
    </DashboardTemplate>
  </DashboardLayout>
</RootLayout>
```

The wrapper names are illustrative, not Next.js exports. In a scratch app on Next.js 16.4.5 (`next build && next start`, Node 24.19.0), the build's route table listed only folders with a `page.jsx`; a colocated `Button.jsx` and a `_c/` folder were absent and answered `404`.

## Pitfalls

- Adding `error.js` next to the layout that throws. It renders below that layout, so the parent's `error.js` (or `global-error.js` for the root) catches it instead.
- Adding `loading.js` next to a slow layout. Without Cache Components the navigation blocks until the layout finishes and the fallback never shows.
- Reading the URL in a layout. Layouts don't re-render on navigation, so they get no `searchParams` or pathname; read those in the page or in a Client Component with `useSearchParams` or `usePathname`.
- Expecting a layout to pass data to its page. It can't; fetch in both and deduplicate with React `cache` or Next's `fetch` dedup.

## Follow-ups

**Q:** Where does the root layout fit?
**A:** It's the top of the tree and must render `<html>` and `<body>`. Nothing in `app/` sits above it except `global-error.js`, which replaces it when the root layout itself throws.

**Q:** What does `template.js` add to the tree?
**A:** A wrapper between the layout and the boundaries, keyed by the segment, so React remounts it when that segment changes. Layouts have no such key and keep their state.

**Q:** Why is the not-found boundary inside the Suspense boundary?
**A:** So `notFound()` thrown while the page streams still renders that segment's `not-found.js` inside the layout, under the same loading fallback.

## Exercises

### Which URLs answer 200?

```jsx
// app/layout.jsx
// app/t/layout.jsx
// app/t/[id]/page.jsx
// app/t/parts/Button.jsx
// app/_c/Counter.jsx
// Requests: /t, /t/a, /t/parts, /t/parts/Button, /_c/Counter
```

**Answer:** Only `/t/a` and `/t/parts` answer `200`, both rendered by `[id]/page.jsx` (`params.id` is `'parts'`). `/t` has no page, `Button.jsx` isn't a page, and `_c` is private, so the other three answer `404`. Observed with `curl` against `next start`, Next.js 16.4.5.
