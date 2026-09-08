---
title: "How do streaming and selective hydration use Suspense?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [streaming, selective-hydration, suspense, server-rendering, partial-pre-rendering, prerender, resume]
related:
  - react/server-rendering/ssr-and-hydration
  - react/server-rendering/hydration-mismatches
  - react/suspense/suspense-mechanics
  - react/suspense/lazy
  - react/suspense/error-boundaries
  - react/concurrent-rendering/scheduler
  - browser/rendering-pipeline/parser-and-render-blocking
verified: 2026-10
perishable:
  - "Instruction names `$RC`, `$RB`, `$RV`, `$RT` and ids `B:0`/`S:0` (React 19.3.1)"
  - "SSR reveals throttled to 300 ms since React 19.2"
  - "Discrete events on unhydrated boundaries are dropped, not replayed"
sources:
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#streaming-more-content-as-it-loads
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#specifying-what-goes-into-the-shell
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#recovering-from-errors-outside-the-shell
  - https://react.dev/reference/react-dom/static/prerender#when-to-use-prerender
  - https://react.dev/reference/react-dom/server/resume#caveats
  - https://react.dev/blog/2022/03/29/react-v18#new-suspense-features
  - https://react.dev/blog/2025/10/01/react-19-2#partial-pre-rendering
  - https://react.dev/blog/2025/10/01/react-19-2#batching-suspense-boundaries-for-ssr
  - https://github.com/reactwg/react-18/discussions/37
  - https://github.com/reactwg/react-18/discussions/130
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/server/fizz-instruction-set/ReactDOMFizzInstructionSetShared.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/ReactDOMEventListener.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/ReactDOMEventReplaying.js
tldr: >
  Each `<Suspense>` boundary is a unit for both. Streaming: the server sends the shell with fallbacks,
  then each boundary's HTML when its data is ready, with a small inline script that swaps it in, even
  before React loads. Selective hydration: boundaries hydrate independently, and one the user clicks
  is hydrated synchronously first so the click is handled.
---

## Answer

Old-style SSR had three waterfalls: fetch all data before sending any HTML, load all JavaScript before hydrating anything, hydrate everything before anything responds. `<Suspense>` boundaries break all three, because each boundary can be sent and hydrated on its own.

**Streaming HTML.** With `renderToPipeableStream` or `renderToReadableStream`, the *shell*, everything outside boundaries, is sent as soon as it renders, with each pending boundary's fallback in place. When a boundary's data arrives, React sends its HTML in a hidden `<div>` at the end of the stream, plus an inline `<script>` that moves it into place. Boundaries complete in any order. The swap needs no React on the client, so content appears before the bundle loads. Since React 19.2, reveals are batched: at most one every 300 ms, as on the client.

**Selective hydration.** `hydrateRoot` hydrates the shell first; each boundary hydrates separately once its HTML and its code (say, a `lazy` chunk) have arrived, in tree order, yielding between pieces so the page stays responsive. If the user clicks inside a boundary that isn't hydrated yet, React hydrates that boundary synchronously in the click's capture phase, then dispatches the click normally. Other boundaries wait.

In React 19.3.1 that works only when the boundary *can* hydrate. If its code hasn't loaded, React stops the event and raises the boundary's priority; the click is lost, not replayed.

**Errors.** A component that throws on the server makes its boundary's fallback final in the HTML; the client renders that boundary from scratch and reports the error to `onRecoverableError`. Only an error in the shell fails the response.

**Partial pre-rendering** (19.2) applies the same split at build time: `prerender` with an aborted `signal` returns the shell as `prelude` plus a `postponed` state; at request time `resume` streams only the boundaries that were left.

## Example

A post page: `<h1>Post</h1>`, then two boundaries whose data resolves after 500 ms and 600 ms. The response as received, chunk by chunk:

```html
<!-- 43 ms: the shell, with both fallbacks -->
<!DOCTYPE html><html><head></head><body><h1>Post</h1>
<!--$?--><template id="B:0"></template><p>Loading comments…</p><!--/$-->
<!--$?--><template id="B:1"></template><p>Loading related…</p><!--/$-->
<script id="_R_">requestAnimationFrame(function(){$RT=performance.now()});</script>

<!-- 540 ms: first boundary's content, hidden, and the instruction to reveal it -->
<div hidden id="S:0"><ul><li>Nice!</li><li>Agreed</li></ul></div>
<script>$RB=[];$RV=function(a){…};$RC=function(a,b){…};$RC("B:0","S:0")</script>

<!-- 637 ms: the second one; the runtime is already defined -->
<div hidden id="S:1"><ol><li>Post B</li></ol></div><script>$RC("B:1","S:1")</script></body></html>
```

React 19.3.1, Node 24, `renderToPipeableStream` without bootstrap scripts, chunks logged with timestamps by a `fetch` client; line breaks added and the two functions elided. `B:0` marks where a boundary goes, `S:0` holds its content; `$RC` queues the pair and `$RV` swaps it in. The names are implementation details.

## Pitfalls

- Expecting a boundary to stream when its data is fetched in an Effect. Effects don't run on the server; only data read with `use` or a Suspense-enabled library suspends.
- A shell with no boundaries, or one boundary around everything. The first means no streaming; the second means the first paint is a spinner.
- Assuming clicks before hydration are queued. Before `hydrateRoot` there's no listener at all, and a click on a boundary whose code is missing was dropped.
- Piping in `onAllReady` for every visitor. The response then starts only when all data is in: no progressive loading. Keep that for crawlers and static generation.

## Follow-ups

**Q:** What did the 19.2 batching look like?
**A:** In Chrome 156, data at 100 and 200 ms appeared together at 311–327 ms; at 100 and 450 ms, about 315 and 615. Firefox 159 ran its first frame later: first reveal at 112–132 ms, the next at least 300 ms after. Near 2.3 s (for LCP) the throttle shortens.

**Q:** What does the client do after a server error in a boundary?
**A:** The shell had `<!--$!-->` and a `<template>` before the fallback. On hydration the client rendered the content and `onRecoverableError` got "Switched to client rendering because the server rendering errored: db down" (production: minified error #419).

**Q:** How did selective hydration behave in the test?
**A:** A sidebar boundary took about 400 ms to hydrate. A trusted click on a comments button 30 ms after `hydrateRoot` hydrated the comments boundary first; its `onClick` ran 57–145 ms after navigation and the sidebar finished at 461–548 ms. Chrome 156 and Firefox 159, development and production.

**Q:** What does `resume` send?
**A:** With the cart boundary still waiting when `prerender` was aborted, the prelude held its fallback and `postponed` was a 624-character JSON object. `resume` with the same tree streamed only `<div hidden id="S:0">…</div>` and the `$RC` script.
