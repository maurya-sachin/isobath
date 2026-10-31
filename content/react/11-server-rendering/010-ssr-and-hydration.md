---
title: "How do server rendering and hydration work in React?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [server-rendering, ssr, hydration, hydrate-root, render-to-pipeable-stream, render-to-readable-stream, prerender]
related:
  - react/server-rendering/hydration-mismatches
  - react/server-rendering/streaming-and-selective-hydration
  - react/server-components/rsc-vs-ssr
  - react/rendering-model/render-and-commit
  - react/effects/effect-timing
  - react/effects/layout-effects
  - react/suspense/suspense-mechanics
  - browser/rendering-pipeline/script-loading
verified: 2026-10
perishable:
  - "Node has the Web Streams server APIs since React 19.2"
  - "Strict Mode double-invokes Effects during hydration since React 19.3"
sources:
  - https://react.dev/reference/react-dom/server#server-apis-for-web-streams
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#parameters
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#rendering-a-react-tree-as-html-to-a-nodejs-stream
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#specifying-what-goes-into-the-shell
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#recovering-from-errors-inside-the-shell
  - https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  - https://react.dev/reference/react-dom/server/renderToReadableStream#returns
  - https://react.dev/reference/react-dom/server/renderToString#caveats
  - https://react.dev/reference/react-dom/server/renderToString#when-a-component-suspends-the-html-always-contains-a-fallback
  - https://react.dev/reference/react-dom/static/prerender#when-to-use-prerender
  - https://react.dev/reference/react-dom/client/hydrateRoot#hydrateroot
  - https://react.dev/reference/react-dom/client/hydrateRoot#caveats
  - https://react.dev/reference/react-dom/client/hydrateRoot#hydrating-server-rendered-html
  - https://react.dev/reference/react-dom/client/hydrateRoot#hydrating-an-entire-document
  - https://react.dev/reference/react-dom/client/hydrateRoot#root-render-caveats
  - https://react.dev/blog/2025/10/01/react-19-2#ssr-web-streams-support-for-node
  - https://react.dev/blog/2025/10/01/react-19-2#prefer-node-streams-for-server-side-rendering-in-nodejs
  - https://react.dev/blog/2026/09/09/react-19-3#changelog
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom/src/client/ReactDOMRoot.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHydrationContext.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
tldr: >
  On the server, `react-dom/server` renders the tree to HTML: `renderToPipeableStream` in Node,
  `renderToReadableStream` with Web Streams. Only render runs there: no Effects, refs or handlers.
  The browser shows that HTML at once. Then `hydrateRoot` renders the same tree on the client and
  adopts the existing DOM nodes instead of creating them, attaching handlers and running Effects.
---

## Answer

Server rendering is two renders of the same tree, in two places.

**On the server**, a `react-dom/server` API calls your components and turns the result into HTML:

- `renderToPipeableStream` (Node streams) and `renderToReadableStream` (Web Streams) stream it. The *shell*, everything outside `<Suspense>` boundaries, goes first; suspended parts follow as their data arrives. Since 19.2 Node has the Web Streams APIs too, but the docs recommend Node streams there for speed.
- `renderToString` returns a string at once. It can't wait for data: a suspended component's nearest `<Suspense>` fallback goes into the HTML and the client renders the content.
- `prerender` and `prerenderToNodeStream` (`react-dom/static`) wait for all data, for static generation.

Only the render phase runs on the server. State initializers run; Effects, layout effects, ref callbacks and event handlers don't. The output is plain HTML plus `<script>` tags for your client bundle (`bootstrapScripts`).

**In the browser**, the HTML paints before any JavaScript runs, so users see content early. When the bundle loads, `hydrateRoot(container, <App />)` renders the same tree again. Instead of creating DOM nodes, React walks the existing ones and **claims** them: each fiber gets the matching node, props and event handlers attach, then the commit runs refs and Effects. The page becomes interactive without its DOM being rebuilt.

That's why the client's first render must produce the same output as the server. A difference is a *hydration mismatch*: React discards the server HTML for that part and renders it from scratch on the client.

Until hydration finishes, the page looks ready but ignores clicks: that gap is the cost of server rendering. Streaming and selective hydration narrow it.

## Example

```jsx
function App() {
  const [count, setCount] = useState(0);
  console.log('render on', typeof window === 'undefined' ? 'server' : 'client');
  useEffect(() => console.log('effect'), []);
  return (
    <html><body>
      <button onClick={() => setCount(count + 1)}>Clicked {count}</button>
    </body></html>
  );
}

// server.js (Node 24)
createServer((req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    bootstrapScripts: ['/client.js'],
    onShellReady() { res.setHeader('content-type', 'text/html'); pipe(res); },
  });
}).listen(3000);
// → render on server

// client.js, loaded by the HTML above
const button = document.querySelector('button');
hydrateRoot(document, <App />);
// → render on client
// → effect
// Click the button:
// → render on client
console.log(button === document.querySelector('button'), button.textContent);
// → true Clicked 1
```

React 19.3.1, development and production builds; the client in Chrome 156 and Firefox 159 over `http://localhost`. The response was `<!DOCTYPE html><html><head><link rel="preload" as="script" fetchPriority="low" href="/client.js"/></head><body><button>Clicked <!-- -->0</button><script src="/client.js" id="_R_" async=""></script></body></html>`. The effect ran only in the browser, and the server's `<button>` node was kept.

## Pitfalls

- Expecting `useEffect` or `useLayoutEffect` to run on the server. Neither does; code that must run before the HTML is sent belongs in render or in the data layer.
- Calling `createRoot` on server-rendered HTML. It throws the HTML away and builds new nodes: the old `<button>` was disconnected.
- Using `renderToString` with data that suspends. The HTML contains only the fallback; switch to a streaming API or `prerender`.
- Rendering something different on the client's first pass (`typeof window`, `Date.now()`). That's a mismatch, not an optimisation.

## Follow-ups

**Q:** When do you use `onShellReady` versus `onAllReady`?
**A:** Pipe in `onShellReady` to stream to people: the shell and fallbacks arrive first. Pipe in `onAllReady` for crawlers or static generation, which want final HTML; there is no progressive loading then. `renderToReadableStream` exposes the same moment as `await stream.allReady`.

**Q:** What if the shell itself throws?
**A:** No bytes have been sent, so `onShellError` fires (or the `renderToReadableStream` promise rejects). Send a 500 or a client-rendered fallback page. An error inside a `<Suspense>` boundary only falls back to that boundary.

**Q:** Can you call `root.render` on a hydrating root?
**A:** After hydration, yes, like any root. The docs warn that calling it before hydration finishes clears the server HTML and switches the whole root to client rendering.

## Deep dive

### How it works

**Server.** `react-dom/server` is React's *Fizz* renderer. It renders components to HTML segments, not fibers: no DOM, no commit phase, so no Effects. Two adjacent text nodes need a separator so the client can find both: `Clicked {count}` became `Clicked <!-- -->0`. Suspense boundaries are wrapped in comment markers (`<!--$-->` … `<!--/$-->` in 19.3.1) that tell the client where a boundary starts and ends.

**Client.** From React 19.3.1's `ReactDOMRoot.js` and `ReactFiberHydrationContext.js` (implementation details):

1. `hydrateRoot` attaches React's event listeners to the container, as `createRoot` does, then schedules the initial render on a *hydration lane*. It returns before rendering: a log right after the call printed before `render on client`.
2. The render is an ordinary render with a cursor into the existing DOM. For each host fiber, `tryToClaimNextHydratableInstance` checks whether the next DOM node has the same tag (`canHydrateInstance`). If it does, the fiber's `stateNode` becomes that node; otherwise it's a mismatch.
3. `hydrateInstance` links the node to its fiber and stores the props, which is where the event system later finds `onClick`. Text is compared to the server text.
4. The commit inserts nothing new; it attaches refs and runs layout effects, then passive Effects.

```js
// What hydration does per element, simplified from ReactFiberConfigDOM.js
function hydrateInstance(domNode, type, props, fiber) {
  precacheFiberNode(fiber, domNode); // domNode → fiber, for events
  updateFiberProps(domNode, props);  // where onClick is read on dispatch
  return hydrateProperties(domNode, type, props); // false → text mismatch
}
```

### Edge cases

What React 19.3.1 exports (checked by importing in Node 24):

| Entry point | Functions |
|---|---|
| `react-dom/server` (Node) | `renderToString`, `renderToStaticMarkup`, `renderToPipeableStream`, `renderToReadableStream`, `resumeToPipeableStream`, `resume` |
| `react-dom/static` (Node) | `prerender`, `prerenderToNodeStream`, `resumeAndPrerender`, `resumeAndPrerenderToNodeStream` |

`renderToString` with a pending `use` inside `<Suspense>` didn't throw. It emitted the fallback inside a client-rendered boundary marker:

```html
<div><i>1</i><!--$!--><template></template><p>Loading</p><!--/$--></div>
```

That's the production build; development also puts the reason, "The server used "renderToString" which does not support Suspense…", in the template's `data-msg`.

`prerender` on the same tree waited and emitted `<!--$--><b>data</b><!--/$-->`. Neither ran the component's Effects or ref callback; its `useState` initializer ran once per render.

Strict Mode: since React 19.3 it double-invokes Effects during hydration too, as with `createRoot`. In the test (development, Chrome 156 and Firefox 159), the component rendered twice and ran its layout effect and Effect twice, while keeping the server node.

### Real-world scenario

A product page served by Node. The server fetches the product, renders the page with `renderToPipeableStream`, and pipes in `onShellReady` with status 200; `onShellError` sends a 500 page. The browser paints the title, price and image from HTML, so the content is visible before the bundle downloads. Reviews sit in a `<Suspense>` boundary and stream later. When `client.js` runs, `hydrateRoot(document, <App />)` attaches the Add to cart handler to the existing button. The data the server used must reach the client too, usually serialized into the HTML by the framework, or the client's first render would differ.

### Trade-offs

Server rendering improves first paint and makes content visible to crawlers and users on slow devices. It doesn't reduce the JavaScript: the client still downloads and runs every component to hydrate it, so time to interactive can be later than with a client-only app, and the page looks clickable before it is. It also needs a server or a build step, and every component must render the same in both environments. Server Components go further by keeping some components off the client entirely.
