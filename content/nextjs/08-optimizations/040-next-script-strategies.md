---
title: "What do the `next/script` strategies change about load order?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [next-script, third-party-scripts, hydration, script-loading, partytown]
related:
  - browser/rendering-pipeline/script-loading
  - react/server-rendering/ssr-and-hydration
  - nextjs/app-router/route-groups-root-layouts
verified: 2026-11
perishable:
  - "Docs say beforeInteractive doesn't block hydration; 16.4.5 bootstrap waits"
  - "worker strategy experimental, never loads in the App Router"
  - "16.4.5 build asks for @builder.io/partytown; docs name @qwik.dev/partytown"
sources:
  - https://nextjs.org/docs/app/api-reference/components/script#beforeinteractive
  - https://nextjs.org/docs/app/api-reference/components/script#afterinteractive
  - https://nextjs.org/docs/app/api-reference/components/script#lazyonload
  - https://nextjs.org/docs/app/api-reference/components/script#worker
  - https://nextjs.org/docs/app/api-reference/components/script#onready
  - https://nextjs.org/docs/app/guides/scripts#inline-scripts
  - https://nextjs.org/docs/app/guides/scripts#offloading-scripts-to-a-web-worker-experimental
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/client/script.tsx
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/client/app-bootstrap.ts
  - https://html.spec.whatwg.org/multipage/scripting.html#attr-script-async
tldr: >
  No strategy puts a `<script src>` in the server HTML. `afterInteractive` (the default) is appended
  by an effect after hydration; `lazyOnload` waits for `load` plus idle time. `beforeInteractive` is
  preloaded, then run by Next's bootstrap before hydration, which waits for it. `worker` is
  experimental and never loads in the App Router.
---

## Answer

`next/script` decides *when* a `<script>` element gets created; once it exists, the browser's normal rules apply. Measured on Next.js 16.4.5 (`next build && next start`; `--webpack` matched) in Chrome 156 and Firefox 159, with a 300 ms `beforeInteractive` script and a slow image holding `load` back:

- **`beforeInteractive`**: the server HTML has a `<link rel="preload" as="script">` and an inline `self.__next_s.push([src])`. Next's bootstrap appends these scripts to `<head>` one by one, waiting for each `load`, and only then hydrates. It ran at 342 ms, after `DOMContentLoaded` (153 ms); hydration followed at 388 ms. The docs say it doesn't block hydration, but a 1.5 s script pushed hydration to 1,651 ms.
- **`afterInteractive`** (default): a preload hint from the server; the element is appended to `<body>` by the component's effect just after hydration (390 ms). It ran at 391 ms, before `load` at 850 ms, only because the image was still loading.
- **`lazyOnload`**: no hint; appended after `load`, inside `requestIdleCallback` (854 ms).
- **`worker`**: experimental, and per the docs not supported in the App Router. With `nextScriptWorkers` on and Partytown installed, the script was never requested.

By comparison, React wrote plain `<script async>` and `<script defer>` straight into the HTML, and both ran at 153 ms, ahead of every strategy.

Two more rules. `onLoad`, `onReady` and `onError` are functions, so only a Client Component can pass them: from a Server Component the build failed with "Event handlers cannot be passed to Client Component props". And scripts are deduplicated per document by `id`, else `src`: the same `src` rendered twice made one element, and navigating away and back didn't run it again. Inline scripts have no `src`, so they need an `id`.

## Example

```jsx
// app/layout.jsx renders, after {children}:
//   <Script src="http://localhost:4101/before.js?ms=300" strategy="beforeInteractive" />
// app/page.jsx
import Script from 'next/script';
import Hydrated from './Hydrated'; // 'use client'; logs from useEffect
import Handlers from './Handlers'; // 'use client'; <Script onLoad onReady onError>

export default function Page() {
  return (
    <main>
      <Hydrated />
      <Handlers />
      <Script src="http://localhost:4101/after.js" />
      <Script src="http://localhost:4101/after.js" />
      <Script src="http://localhost:4101/lazy.js" strategy="lazyOnload" />
      <script async src="http://localhost:4101/plainasync.js?ms=100" />
      <script defer src="http://localhost:4101/plaindefer.js?ms=100" />
    </main>
  );
}
```

Chrome 156 logged: `plaindefer`, `DOMContentLoaded` and `plainasync` at 145 ms, `before` 338, `load` 376, `hydrated` 380, `after` and `onLoad`/`onReady`/`onError` 384, `lazy` 393. One `after.js` element. Firefox 159 kept the order, but `onError` came at 380 ms with `lazy`. With nothing else loading, `load` came before hydration, so `afterInteractive` ran after it.

## Pitfalls

- `beforeInteractive` outside the root layout. The build didn't complain and a full load of the page ran it, but a client-side navigation to the page only preloaded the file; it never ran.
- An inline `<Script>` without `id`. It ran again each time the page was navigated back to; the one with an `id` ran once.
- Treating `beforeInteractive` as "before the page parses". It runs after `DOMContentLoaded` and after plain `defer` scripts, and it delays hydration by its full download time.
- Assuming `afterInteractive` beats `load`. It's tied to hydration, not to `load`; which comes first depends on what else the page loads.

## Follow-ups

**Q:** Does a layout's `afterInteractive` script run again on navigation?
**A:** No. The loader keeps a per-document cache keyed by `id` or `src`: `nav.js` was requested once across `/p1` → `/p2` → `/p1`, with one element in the DOM.

**Q:** `onLoad` or `onReady`?
**A:** `onLoad` fires once, when the file loads. Per the docs and source, `onReady` also fires on every later mount once the script is cached, so it fits re-initialising a widget after navigation (remount not run here).

**Q:** What does enabling `worker` ask for?
**A:** `experimental.nextScriptWorkers` made the 16.4.5 build fail until `@builder.io/partytown` was installed; the guide names `@qwik.dev/partytown`. Even then, the App Router page rendered no script for it.
