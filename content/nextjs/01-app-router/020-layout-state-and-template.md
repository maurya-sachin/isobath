---
title: "Why does a layout keep its state on navigation, and when do you need `template.js`?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [app-router, layout, template, state, navigation, activity]
related:
  - nextjs/app-router/app-router-component-tree
  - react/reconciliation/preserving-and-resetting-state
  - react/reconciliation/activity
  - nextjs/navigation/state-retained-on-back-navigation
verified: 2026-11
perishable:
  - "Cache Components keeps up to 3 visited routes hidden (Next.js 16.4)"
  - "router.bfcacheId as the reset key under Cache Components"
sources:
  - https://nextjs.org/docs/app/getting-started/linking-and-navigating#client-side-transitions
  - https://nextjs.org/docs/app/api-reference/file-conventions/layout#caveats
  - https://nextjs.org/docs/app/api-reference/file-conventions/template#behavior
  - https://nextjs.org/docs/app/api-reference/file-conventions/template#templates-during-navigation-and-remounting
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents#navigation-with-activity
  - https://nextjs.org/docs/app/guides/preserving-ui-state
  - https://nextjs.org/docs/app/api-reference/functions/use-router#bfcacheid
tldr: >
  On a client-side navigation Next.js keeps the layouts shared by the old and new route and
  renders only the segments below it, so the layout's Client Components stay at the same tree
  position and React keeps their state. `template.js` sits under the layout, keyed by its
  segment, so it remounts when that segment changes: state resets and effects re-run.
---

## Answer

A `<Link>` navigation doesn't reload the document. Next.js compares the old and new routes, keeps the layouts they share, and renders only the segments below the deepest shared layout. Because the layout's elements stay at the same position with the same component types, React keeps their state: that's ordinary reconciliation, not a Next.js cache. A sidebar's open menu, a search box or a playing video in a layout all survive. The layout also doesn't re-render on the server, which is why it gets no `searchParams` or pathname.

`template.js` wraps the same children but receives a **key for its own segment**. When that segment's value changes (`/blog/a` → `/blog/b`), the key changes and React remounts it: Client Component state is reset, the DOM is recreated and effects run again. Deeper navigations don't remount a higher template, and search-param-only changes remount nothing.

Use a template when something should start fresh per page while living above it: an enter animation, an effect that must re-run for each page, or form state to clear. Often a `key` on one component is enough (`<Form key={id} />`); a template keys the whole subtree.

With **Cache Components** (`cacheComponents: true`) there's a second layer. Next.js hides the route you leave with React `<Activity>` instead of unmounting it, and keeps up to three. Returning by `<Link>` or Back brings the old template instance back, state included: the template still resets on a *first* visit, not on a return. To reset on every fresh push while keeping Back/Forward restoration, the docs recommend keying on `useRouter().bfcacheId`.

## Example

```jsx
// app/t/layout.jsx
import Counter from '../_c/Counter';
export default function TLayout({ children }) {
  return <section><Counter name="layout" /><input />{children}</section>;
}

// app/t/template.jsx (a Server Component, like a layout)
import Counter from '../_c/Counter';
export default function TTemplate({ children }) {
  return <div><Counter name="template" /><input />{children}</div>;
}

// app/_c/Counter.jsx
'use client';
import { useEffect, useState } from 'react';
export default function Counter({ name }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    console.log(`${name} mounted`);
    return () => console.log(`${name} unmounted`);
  }, [name]);
  return <button onClick={() => setN(n + 1)}>{name}: {n}</button>;
}
```

On `/t/a`, click both buttons twice and type in both inputs, then follow a `<Link>` to `/t/b`. The layout still reads `layout: 2` with its text; the template reads `template: 0` with an empty input, and the console shows `template unmounted`, `template mounted`. Chrome 156 and Firefox 159, Next.js 16.4.5 under `next start`, Cache Components off.

## Pitfalls

- Expecting a layout's Client Component to reset on navigation. It doesn't; key the component or move it into a template.
- Using a template just to read the new pathname. A Client Component calling `usePathname` already re-renders on navigation without losing state.
- Assuming a template always gives a fresh mount. With Cache Components, returning to a recently visited segment restored `template: 2` and the typed text, because the hidden instance was shown again.
- Putting heavy work in a template. It remounts its whole subtree, effects and DOM included, on every change of its segment.

## Follow-ups

**Q:** Does navigating to another top-level route reset the layout?
**A:** Yes. Going from `/t/a` to `/other` logged `layout unmounted` and `template unmounted`; with Cache Components off, coming back showed both at `0`. A layout keeps state only while it's shared by both routes.

**Q:** What did Cache Components change in that test?
**A:** Going to `/other` and pressing Back showed `layout: 2` and `template: 3`, the values left behind. Effects still logged `unmounted` and `mounted`, because Activity cleans up effects when hiding, but state and DOM were kept. The left route stayed in the DOM with `display: none`.

**Q:** Why not just put `key={pathname}` on the layout's children?
**A:** A layout can't read the pathname on the server; you'd need a Client Component wrapper. That's what a template already is: a keyed wrapper at the right level.

## Exercises

### Does the template remount?

```jsx
// Same files as the Example, Cache Components off.
// On /t/a: click "template" once.
// Then follow <Link href="/t/a?q=1">.
```

**Answer:** No. The button still reads `template: 1` and nothing is logged. Templates key on the segment and its dynamic params; a search-param-only change keeps the same key. Chrome 156 and Firefox 159, Next.js 16.4.5.
