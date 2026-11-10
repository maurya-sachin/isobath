---
title: "How do intercepting routes give a modal its own URL that survives a refresh?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [app-router, intercepting-routes, parallel-routes, modal, navigation]
related:
  - nextjs/app-router/parallel-routes-default
  - nextjs/app-router/app-router-component-tree
  - nextjs/navigation/link-click-to-render
  - browser/navigation/history-api-routing
verified: 2026-11
perishable:
  - "Interception routes need a canonical route since Next.js 16.4.0"
sources:
  - https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes#convention
  - https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes#modals
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#modals
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#opening-the-modal
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#closing-the-modal
  - https://nextjs.org/docs/app/api-reference/file-conventions/default
  - https://github.com/vercel/next.js/releases/tag/v16.4.0
  - https://github.com/vercel/next.js/pull/97428
tldr: >
  A folder like `@modal/(..)photo/[id]` intercepts client navigations to `/photo/[id]` made from
  inside that layout: the URL changes, but the photo renders in the `@modal` slot over the current
  page. A refresh or shared link skips interception and loads the real `photo/[id]` page, so the
  URL always shows that photo. Markers count route segments, not folders.
---

## Answer

Two conventions combine:

- A **parallel route slot** (`@modal`) gives the layout a place to render the modal next to `children`. Its `default.js` returns `null`, so normally there's no modal.
- An **intercepting route** inside the slot, named with a marker plus the target path, such as `(..)photo/[id]`, tells the router: when a **client-side navigation** from under this layout goes to `/photo/[id]`, render this page in the slot instead of replacing the page.

So a `<Link href="/photo/1">` click in the feed pushes `/photo/1` to history, keeps the feed mounted with its state, and shows the intercepted page in `@modal`. **Back** pops to `/feed` and the modal disappears; **Forward** brings it back. A **refresh** or a pasted URL is a hard navigation: nothing is intercepted, and the canonical `app/photo/[id]/page.js` renders as a full page. That's what "survives a refresh": the URL always means "this photo", in a modal or on its own page.

The markers are relative to **route segments**, not folders: `(.)` same level, `(..)` one level up, `(..)(..)` two up, `(...)` from the `app` root. Slots and route groups aren't segments. In `app/feed/@modal/(..)photo`, the intercepting folder is two folders below `feed/` but only one segment, so `(..)` reaches `/photo`.

Since 16.4.0, `next build` rejects an intercepting route with no matching canonical route, which catches a wrong marker.

Interception happens only where the layout holding the slot is rendered. A link to `/photo/1` from `/other` loaded the full photo page, client-side, with no modal.

## Example

```jsx
// app/feed/layout.jsx
export default function FeedLayout({ children, modal }) {
  return <section>{children}{modal}</section>;
}

// app/feed/@modal/default.jsx: no modal unless intercepted
export default function Default() { return null; }

// app/feed/@modal/(..)photo/[id]/page.jsx: soft navigation from /feed
export default async function PhotoModal({ params }) {
  const { id } = await params;
  return <dialog open>Photo {id}</dialog>;
}

// app/photo/[id]/page.jsx: refresh, shared link, or navigation from elsewhere
export default async function PhotoPage({ params }) {
  const { id } = await params;
  return <h1>Photo {id}</h1>;
}
```

Next.js 16.4.5 under `next start`, Chrome 156 and Firefox 159: from `/feed` with a counter at 1, clicking the link showed URL `/photo/1`, the dialog, and the feed still reading 1. Back: `/feed`, no dialog, counter 1. Forward: the dialog again. Reload: the full page, no feed.

## Pitfalls

- Counting folders for the marker. `app/feed/@modal/(.)photo` failed the build: `Interception routes must have a canonical route`, `/feed/(.)photo/[id] (expected /feed/photo/[id])`.
- Closing the modal with a `<Link>` to the page behind it. Clicking a link to `/feed` inside the dialog changed the URL but left the dialog open, because the slot kept its last page. Use `router.back()`, or give the slot a `page.js` or catch-all that returns `null`.
- Forgetting the canonical page. A refresh needs `app/photo/[id]/page.js`; since 16.4.0 the build fails without it.
- Expecting interception from anywhere. It only applies when navigating from within the layout that renders the slot; the docs' login modal puts its slot in the root layout so it opens from any page.

## Follow-ups

**Q:** Why not a plain modal with `useState`?
**A:** It has no URL: it can't be shared, refresh closes it, and Back leaves the page instead of closing the modal. The intercepted route puts the modal into history.

**Q:** What did `(..)(..)photo` do in the same folder?
**A:** The build failed: `Invalid interception route: /feed/(..)(..)photo/[id]. Cannot use (..)(..) marker at the root level or one level up.` `(...)photo` built and intercepted correctly.

**Q:** Can the modal and the full page share code?
**A:** Yes. Put the photo UI in a component both pages render; only the wrapper differs, a `<dialog>` in the slot and a page layout in the canonical route.
