---
title: "What are parallel routes, and why must every slot have `default.js`?"
status: draft
difficulty: hard
frequency: 2
core: false
tags: [app-router, parallel-routes, slots, default-js, navigation]
related:
  - nextjs/app-router/app-router-component-tree
  - nextjs/app-router/intercepting-routes-modal
  - nextjs/app-router/loading-error-not-found-boundaries
verified: 2026-11
perishable:
  - "Strict route matching on by default since Next.js 16.4.0"
  - "deprecated.looseRouteMatching restores the old 404 behaviour"
sources:
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#slots
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#behavior
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#conditional-routes
  - https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes#loading-and-error-ui
  - https://nextjs.org/docs/app/api-reference/file-conventions/default
  - https://nextjs.org/docs/app/guides/upgrading/version-16#parallel-routes-defaultjs-requirement
  - https://github.com/vercel/next.js/releases/tag/v16.4.0
  - https://github.com/vercel/next.js/pull/97397
tldr: >
  An `@name` folder is a slot: a page tree passed to the parent layout as a prop, like
  `children`, itself a slot. Slots add no URL segment. On client navigation an unmatched slot
  keeps its last page; after a reload Next.js can't recover that, so it renders `default.js`.
  Next.js 16.4 fails the build without one.
---

## Answer

**Parallel routes** let one layout render several independent page trees at once. Each `@folder` is a **slot**, passed to the parent layout as a prop with that name; `children` is an implicit slot (`app/page.js` is `app/@children/page.js`). Slots aren't route segments: `app/dash/@team/settings/page.js` serves `/dash/settings`. Each slot can have its own `loading.js` and `error.js`, so a dashboard panel can stream or fail on its own.

Each URL needs an answer from **every** slot. For `/dash/settings`, `@team` has a page but `children` and `@analytics` may not. What they show depends on the navigation:

- **Soft navigation** (`<Link>`, `router.push`): Next.js remembers each slot's active page and keeps it. Clicking from `/dash` to `/dash/settings` swaps only `@team`; the others keep showing their `/dash` pages, though the URL no longer matches them.
- **Hard navigation** (reload, pasted URL): that memory is gone. Next.js renders each unmatched slot's `default.js`.

So `default.js` is the slot's answer for "I have nothing for this URL after a full load". It can return `null` (a modal slot that's closed), call `notFound()`, or render a real fallback. It receives `params`.

In Next.js 16.4.5, **strict route matching** (on by default since 16.4.0) checks this at build time: a missing `default.js` for any slot, `children` included, fails `next build`. Before that, a missing named-slot default meant a `404` at request time, which some docs pages still describe; `deprecated.looseRouteMatching: true` restores it.

Slots are combined into one page for the segment, so they share its rendering mode: if one slot is dynamic, all of them are. A layout that picks a slot by role still renders **both** on the server, so authorize inside each slot.

## Example

```jsx
// app/dash/layout.jsx
export default function DashLayout({ children, team, analytics }) {
  return (
    <section>
      <main>{children}</main>
      <aside>{team}</aside>
      <aside>{analytics}</aside>
    </section>
  );
}

// app/dash/page.jsx                 children at /dash
// app/dash/@team/page.jsx           team at /dash
// app/dash/@team/settings/page.jsx  team at /dash/settings
// app/dash/@analytics/page.jsx      analytics at /dash
// app/dash/@analytics/default.jsx   analytics when unmatched
// app/dash/default.jsx              children when unmatched
```

Next.js 16.4.5, `next start`, Chrome 156 and Firefox 159. Load `/dash`, then click a `<Link>` to `/dash/settings`: the slots read "dash children page", "team settings page", "analytics page". Reload: "children default", "team settings page", "analytics default".

## Pitfalls

- Forgetting the `children` default. Without `app/dash/default.jsx` the build failed with `/dash/settings is missing a matching page or default.tsx in children`.
- Expecting a slot to clear on soft navigation. It keeps its last page; give it a page or catch-all that returns `null` for routes where it should be empty.
- Hiding a slot by role and thinking it didn't run. Both slots render and fetch on the server; the condition only picks the output.
- Testing only with `<Link>` clicks. Defaults matter after a reload or a shared link, so test both.

## Follow-ups

**Q:** What exactly did the 16.4.5 build print without any defaults?
**A:** `Parallel route slots cannot render the same URLs` naming `@analytics, children`, plus `Unmatched app pages` for `@team/settings/page.jsx`, and a warning that strict route matching is on by default.

**Q:** How do you read which page a slot is showing?
**A:** In a Client Component, `useSelectedLayoutSegment('analytics')`. The argument is the slot name, without `@`.

**Q:** Do slots need a `default.js` if no sub-route exists?
**A:** In 16.4.5, yes whenever any sibling matches a URL the slot doesn't. A modal slot with no page for `/feed` failed the build until `default.jsx` returning `null` was added.
