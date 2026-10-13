---
title: "What causes hydration mismatches, and how do you fix them?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [hydration, hydration-mismatch, suppress-hydration-warning, use-id, browser, server-rendering]
related:
  - react/server-rendering/ssr-and-hydration
  - react/server-rendering/streaming-and-selective-hydration
  - react/rendering-model/purity-and-strict-mode
  - react/effects/effect-timing
  - react/suspense/use-api
  - react/suspense/error-boundaries
  - html-and-css/documents-and-semantics/content-model-and-parser-repair
verified: 2026-10
perishable:
  - "React 19.3.1 doesn't patch mismatched attributes"
  - "`browser` from react-dom added in React 19.3"
  - "useId prefix `_R_` (server/hydration) and `_r_` (client) since 19.2"
sources:
  - https://react.dev/reference/react-dom/client/hydrateRoot#caveats
  - https://react.dev/reference/react-dom/client/hydrateRoot#hydrating-server-rendered-html
  - https://react.dev/reference/react-dom/client/hydrateRoot#suppressing-unavoidable-hydration-mismatch-errors
  - https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
  - https://react.dev/reference/react/use#use-browser
  - https://react.dev/reference/react/use#browser-caveats
  - https://react.dev/blog/2026/09/09/react-19-3#browser
  - https://react.dev/blog/2024/12/05/react-19#diffs-for-hydration-errors
  - https://react.dev/blog/2024/12/05/react-19#compatibility-with-third-party-scripts-and-extensions
  - https://react.dev/reference/react/useId#why-is-useid-better-than-an-incrementing-counter
  - https://react.dev/reference/react/useId#using-the-same-id-prefix-on-the-client-and-the-server
  - https://react.dev/blog/2025/10/01/react-19-2#update-the-default-useid-prefix
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHydrationContext.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
tldr: >
  A mismatch is the client's first render differing from the server HTML: browser-only checks,
  dates, randomness, different data, invalid nesting the parser rearranged. A different tag or
  text makes React throw away the server DOM up to the nearest `<Suspense>` boundary and render it
  again; a different attribute is only warned about and left wrong. Make both renders identical.
---

## Answer

Hydration assumes the client's first render matches the server HTML. A **mismatch** is any difference; React 19's development build reports it with a diff.

**Common causes:**

- Branching on the environment in render: `typeof window`, `localStorage`, `matchMedia`.
- Values that change between renders: `Date.now()`, `Math.random()`, a date formatted in the server's time zone or locale.
- Different data: the client fetched newer data instead of reusing the server's.
- Invalid nesting: the server sends `<p><div>`, the HTML parser closes the `<p>`, and the DOM no longer matches the tree.
- Nodes injected by extensions, or whitespace around the HTML inside the root container.

**What React does** (React 19.3.1, measured):

- **Different tag or text**: hydration fails at that point. React reports a recoverable error ("Hydration failed because the server rendered text didn't match the client…"), discards the server DOM up to the nearest `<Suspense>` boundary, or the whole root without one, and renders it on the client. `onRecoverableError` receives it.
- **Different attribute**: only a development `console.error` ("…This won't be patched up."). The DOM keeps the server's value, which the docs allow: attribute fixes aren't guaranteed.

**Fixes**, best first:

1. Make the render deterministic: pass the server's data and timestamps to the client, format dates with an explicit `timeZone`, fix the markup, and generate ids with `useId`, which derives them from tree position.
2. For content that can only exist in the browser, render a placeholder first. Either set a flag in `useEffect` and render a second pass, or, since React 19.3, call `use(browser())` from `react-dom` inside a `<Suspense>` boundary: the server sends the fallback and the client renders the content.
3. For one unavoidable difference, such as a timestamp, put `suppressHydrationWarning` on that element. It covers only that element's own text and attributes, and React won't patch them.

## Example

```jsx
const side = typeof window === 'undefined' ? 'server' : 'client';
function AttributeOnly() {
  return <p className={side}>Hello</p>;
}
function TextToo() {
  return <p className={side}>{side}</p>;
}

// Server (Node 24)
console.log(renderToString(<AttributeOnly />));
// → <p class="server">Hello</p>
console.log(renderToString(<TextToo />));
// → <p class="server">server</p>

// Browser: containers a and b hold that HTML
const options = { onRecoverableError: (e) => console.log(e.message.slice(0, 73)) };
hydrateRoot(a, <AttributeOnly />, options);
hydrateRoot(b, <TextToo />, options);
// → Hydration failed because the server rendered text didn't match the client
console.log(a.innerHTML, b.innerHTML); // after hydration
// → <p class="server">Hello</p> <p class="client">client</p>
```

Development build of React 19.3.1 in Chrome 156 and Firefox 159. Development also logged "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up." for `a`, with a diff. The production build left the attribute wrong silently and reported the text mismatch as "Minified React error #418".

## Pitfalls

- Fixing a mismatch with `typeof window` in render. That *is* the mismatch; move the browser-only part into an Effect or behind `use(browser())`.
- Spreading `suppressHydrationWarning` on a parent. It doesn't reach children: on a `<div>` around the differing `<p>`, the error still fired and the subtree was re-rendered.
- Ignoring attribute warnings because nothing crashed. The server's `class` stayed on the element in both builds: wrong styling with no error in production.
- Generating ids with a counter. Hydration order can differ from server order; `useId` matched (`_R_0_` on both sides).

## Follow-ups

**Q:** How much does a text mismatch throw away?
**A:** Up to the nearest `<Suspense>` boundary. With `<b>` outside a boundary and the mismatching `<p>` inside it, `<b>` kept its server node and the boundary's nodes were recreated. Without a boundary, every node in the root was recreated.

**Q:** Do browser extensions cause mismatches?
**A:** Less since React 19, which skips unexpected tags in `<head>` and `<body>` when hydrating the document. A `<div>` injected at the start of `<body>`, or a `<style>` in `<head>`, caused no error. One injected inside `<main>` failed hydration, and the client render removed it.

**Q:** What does `<p><div>` look like after the parser?
**A:** The server sent `<p>a<div>b</div></p>`; the DOM held `<p>a</p><div>b</div><p></p>`. Development warned "In HTML, <div> cannot be a descendant of <p>. This will cause a hydration error.", then hydration failed and the client re-rendered.

**Q:** Does `use(browser())` report an error?
**A:** No. On the server the boundary is marked client-rendered ("Switched to client rendering because a component requested it."); on the client the content rendered with no `onRecoverableError` call.

## Exercises

### One newline

The server HTML is placed in the page with a line break before it:

```html
<div id="root">
  <div><label for="_R_0_">Name</label><input id="_R_0_"/></div></div>
```

The component renders `useId` into `htmlFor` and `id`. What is in the container after `hydrateRoot`?

**Answer:** `<div><label for="_r_0_">Name</label><input id="_r_0_"></div>`, all new nodes. The whitespace text node didn't match the expected `<div>`, so hydration failed with "Hydration failed because the server rendered HTML didn't match the client" and the root was client-rendered. A client-rendered `useId` uses the lowercase `_r_` prefix, so even the ids changed (Chrome 156 and Firefox 159).
