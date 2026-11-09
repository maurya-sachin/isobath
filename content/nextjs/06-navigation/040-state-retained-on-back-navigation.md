---
title: "Why does a page keep its state after navigating back with Cache Components on?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [navigation, cache-components, activity, state, back-navigation, bfcache-id]
related:
  - react/reconciliation/activity
  - nextjs/app-router/layout-state-and-template
  - nextjs/navigation/link-click-to-render
  - nextjs/navigation/client-router-cache-stale-times
  - browser/navigation/back-forward-cache
verified: 2026-11
perishable:
  - "Three routes kept, counting the visible one (16.4.5)"
  - "Hidden route styled display: none !important (React 19.3)"
  - "router.bfcacheId as the reset key under Cache Components"
sources:
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents#navigation-with-activity
  - https://nextjs.org/docs/app/guides/preserving-ui-state#choosing-what-to-preserve
  - https://nextjs.org/docs/app/guides/preserving-ui-state#state-and-authentication
  - https://nextjs.org/docs/app/guides/preserving-ui-state#effect-and-media-cleanup
  - https://nextjs.org/docs/app/guides/preserving-ui-state#testing
  - https://nextjs.org/docs/app/api-reference/functions/use-router#bfcacheid
  - https://react.dev/reference/react/Activity
tldr: >
  With `cacheComponents: true`, the router doesn't unmount the page you leave: it wraps it in React
  `<Activity mode="hidden">`, which keeps its state and DOM but hides it with `display: none` and runs
  effect cleanups. Back, or a link to it, shows the same instance again. Only the last few routes are
  kept; older ones remount fresh.
---

## Answer

Without Cache Components, navigating away unmounts the page segment: its Client Components' state and DOM are gone, and Back renders it again from scratch.

With `cacheComponents: true`, Next.js wraps each route in React's `<Activity>`. Leaving a route sets it to `hidden`: React keeps the components mounted and the DOM in place, hides the DOM with `display: none`, and runs effect cleanups as if it had unmounted. Coming back sets it to `visible`, so the same instance reappears: `useState` values, typed input, open `<details>`, scroll position on Back, and effects set up again.

What I saw on Next.js 16.4.5 (`next start`), identical in Chrome 156 and Firefox 159, for a page with a text input, a `useState` counter and a `<details>`:

- **Cache Components on, Back:** input, count, `<details>` and `scrollY` 1500 all restored.
- **On, return by `<Link>`:** state restored, scroll at the top, as for any push.
- **Off, Back:** the input empty, the count 0, `<details>` closed. The scroll position was still restored.

It isn't unlimited. The docs say up to three routes are kept. The page survived after visiting two other routes and was fresh after three, so three counts the one on screen. It also isn't the browser's back/forward cache: the document never changed.

This changes defaults you may have relied on. A success message, an open dropdown or another user's draft stays until reset. The docs suggest resetting in an event handler, in a `useLayoutEffect` cleanup that runs on hide, or by keying a subtree on `useRouter().bfcacheId`, which changes on push and replace but not on Back or Forward.

## Example

```jsx
// app/form/draft.jsx
'use client';
import { useEffect, useState } from 'react';
export default function Draft() {
  const [n, setN] = useState(0);
  useEffect(() => {
    console.log('draft effect on');
    return () => console.log('draft effect off');
  }, []);
  return (
    <div>
      <input id="name" />
      <button onClick={() => setN(n + 1)}>count: {n}</button>
      <details><summary>more</summary>hidden text</details>
    </div>
  );
}

// app/form2/keyed.jsx: reset on fresh visits, keep on Back
'use client';
import { useRouter } from 'next/navigation';
import Draft from '../form/draft';
export default function Keyed() {
  const { bfcacheId } = useRouter();
  return <Draft key={bfcacheId} />;
}
```

With Cache Components on: type `draft`, click 3 times, follow a link to `/s`. The console shows `draft effect off`; `/form`'s `<main>` is still in the document with `style="display: none !important;"`. Back shows `draft`, `count: 3` and `draft effect on`. With `Keyed`, Back kept `draft`, but a fresh link to `/form2` showed an empty input and `count: 0`.

## Pitfalls

- Querying the DOM in tests or scripts after navigating. While on `/s`, `document.querySelectorAll('#form-main')` still matched the hidden page; filter by visibility or use role-based queries.
- Assuming effects keep running on a hidden page. Cleanups ran on hide, so timers and subscriptions stop; per the docs, a `<video>` keeps playing under `display: none` unless an effect pauses it.
- Expecting a returning user to see a fresh form after submitting. Reset it in the submit handler; the docs warn the same about state left from a previous user after logout.
- Treating state retention as permanent. After three other routes, Back to the page showed an empty form.

## Follow-ups

**Q:** Do layouts behave differently?
**A:** No. A layout shared by both routes was never hidden: it stays mounted on any navigation. Activity matters for the segments that change.

**Q:** Is the page's data re-fetched on Back?
**A:** No. Back restored the hidden route without a request. A `<Link>` to a dynamic page fetched it again: a new server timestamp.

**Q:** How do you force a full reset on logout?
**A:** Per the docs, not run here: navigate with `window.location.href` for a full document load, or key components by user id.
