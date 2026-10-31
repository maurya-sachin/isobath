---
title: "Where does the client boundary go, and what does `use client` mark?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [use-client, client-components, server-components, module-graph, client-reference, bundling]
related:
  - react/server-components/rsc-vs-ssr
  - react/server-components/rsc-serialization
  - react/server-components/server-functions
  - react/server-rendering/ssr-and-hydration
  - react/context-and-composition/composition-patterns
  - react/context-and-composition/context-propagation
verified: 2026-10
perishable:
  - "Plugin in 19.3.1 needs webpack internals that 5.112 moved"
  - "Payload row format (`I`, `$L`) is react-server-dom-webpack 19.3.1's"
sources:
  - https://react.dev/reference/rsc/use-client#use-client
  - https://react.dev/reference/rsc/use-client#caveats
  - https://react.dev/reference/rsc/use-client#how-use-client-marks-client-code
  - https://react.dev/reference/rsc/use-client#how-is-fancytext-both-a-server-and-a-client-component
  - https://react.dev/reference/rsc/use-client#why-is-copyright-a-server-component
  - https://react.dev/reference/rsc/use-client#when-to-use-use-client
  - https://react.dev/reference/rsc/use-client#building-with-interactivity-and-state
  - https://react.dev/reference/rsc/use-client#using-third-party-libraries
  - https://react.dev/reference/rsc/server-components#adding-interactivity-to-server-components
  - https://react.dev/blog/2026/09/09/react-19-3#context-can-be-rendered-directly-in-server-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server-dom-webpack/src/ReactFlightWebpackPlugin.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server-dom-webpack/src/ReactFlightWebpackNodeLoader.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server-dom-webpack/src/ReactFlightWebpackReferences.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server/src/ReactFlightServer.js
tldr: >
  `'use client'` at the top of a file marks that module and everything it imports as client code. It's
  a cut in the module graph, not the render tree: server code that imports it gets a reference, the
  browser gets the code. Client Components are still server-rendered to HTML. Mark only entry points;
  pass Server Components in as `children`.
---

## Answer

In an RSC app, modules are server code by default. `'use client'` at the very top of a file (above imports; comments are fine; quotes, not backticks) marks **that module and all its transitive dependencies** as client code. Where server code imports such a module, the bundler cuts the graph: the server gets a *client reference* for each export, and the client bundle gets the module plus everything it imports.

What follows from that:

- **It marks modules, not components.** `caption.js` below has no directive but ships to the browser because a client module imports it. A module without a directive can run on both sides, depending on who imports it.
- **"Client" doesn't mean "only in the browser".** Client Components are still server-rendered to HTML and hydrated. The RSC server just never runs them: it sends a reference in the payload.
- **Only entry points need it.** Inside the client graph the directive has no effect. Add it where server code imports something that needs the client: state, Effects, event handlers, browser APIs, or a third-party component that uses them and doesn't ship its own marker.

Direction matters. A Server Component can import and render a Client Component, passing serializable props. A client module can't import a Server Component: the import would make it client code. But a Client Component can *render* Server Component output when a Server Component passes it in as `children` or another JSX prop. The render tree can nest server inside client; the module graph can't.

So put the boundary low: mark the small interactive leaves and keep pages and data-loading parents as Server Components. Modules that must never reach the client can import the `server-only` package, which throws outside the `react-server` condition.

## Example

```jsx
// App.js: a Server Component
import Toggle from './Toggle.js';
import Details from './Details.js';
export default function App() {
  return <Toggle label="Shipping"><Details /></Toggle>;
}
// Details.js: a Server Component, no directive
import { readFile } from 'node:fs/promises';
export default async function Details() {
  const days = (await readFile('./days.txt', 'utf8')).trim();
  return <p>Ships in {days} days</p>;
}
// Toggle.js
'use client';
import { useState } from 'react';
import { caption } from './caption.js'; // no directive: client code anyway
export default function Toggle({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button onClick={() => setOpen(!open)}>{caption(label, open)}</button>
      {open && children}
    </section>
  );
}
// webpack client build → client0.js: ./Toggle.js ./caption.js
// payload → 1:I["./Toggle.js",["client0","client0.js"],"default"]
//         → 0:["$","$L1",null,{"label":"Shipping","children":"$L2"}]
//         → 2:["$","p",null,{"children":["Ships in ","3"," days"]}]
```

webpack 5.105 with `react-server-dom-webpack/plugin` 19.3.1 for the client; the payload from Node 24 with `--conditions react-server` and the package's ESM loader, production build. `App.js` and `Details.js` are in no client chunk, and the RSC server never evaluated `caption.js`. Server-rendering the payload gave `<section><button>Show shipping</button></section>`. In Chrome 156 and Firefox 159, clicking Show rendered `<p>Ships in 3 days</p>`: `Details`' output, not its code.

## Pitfalls

- Reading `'use client'` as "rendered only in the browser". `Toggle` above was server-rendered to HTML like any component.
- Importing a Server Component into a client module to render it. It becomes client code; with `Details` imported by `Toggle`, webpack failed: `UnhandledSchemeError: Reading from "node:fs/promises" is not handled by plugins`. Pass it in as `children` instead.
- Putting the directive below an import. It's then not a directive: the plugin made no client chunk, and Node ran `Toggle.js` as server code, failing on `import { useState }` because React's `react-server` build doesn't export it.
- Marking a page or layout as client to make one button interactive. Everything it imports joins the bundle, and it can no longer be async or read server data.

## Follow-ups

**Q:** Can a Server Component call a function exported from a `'use client'` module?
**A:** No; it holds a reference. Calling it threw "Attempted to call format() from the server but format is on the client…"; reading a property threw "Cannot access format.toString on the server. You cannot dot into a client module from a server component…". It can only render or pass it.

**Q:** Is a component without a directive a Server Component?
**A:** Only where server code imports it. The same definition imported from a client module is a Client Component there, so its module runs in both places. The docs' `FancyText` example is exactly this.

**Q:** Can a Server Component provide context to the Client Components below it?
**A:** It can't create context, but since React 19.3 it can render a `<Context value>` whose context object comes from a `'use client'` module.

**Q:** Which third-party components need a client wrapper?
**A:** Per the docs, those using `createContext`, Hooks other than `use` and `useId`, `forwardRef`, `memo`, `startTransition`, or browser APIs. If the library doesn't ship its own `'use client'`, wrap it in a Client Component file of your own.

## Deep dive

### How it works

The directive is read by tooling, not by React at runtime. An RSC setup builds two module graphs (implementation details of `react-server-dom-webpack` 19.3.1):

- **Server graph**, resolved with the `react-server` condition. The Node loader (or a bundler doing the same) checks each module's leading directives. For a `'use client'` module it doesn't evaluate the code; it replaces each export with a client reference. In the test, `Toggle` on the server was an object with `$$typeof: Symbol(react.client.reference)` and `$$id` ending in `Toggle.js#default`.
- **Client graph.** `ReactServerWebpackPlugin` scans the configured directories, parses each file, and keeps the ones whose leading directives include `'use client'`. Each becomes the root of an async chunk, and the plugin writes `react-client-manifest.json`:

```js
// react-client-manifest.json, from the build above
{
  "file:///…/out/Toggle.js": { "id": "./Toggle.js", "chunks": ["client0", "client0.js"], "name": "*" }
}
```

When `ReactFlightServer` meets a client reference while serializing, it looks it up in that manifest and emits an import row (`1:I[…]`); the element points at it with `$L1`. The client loads `client0.js` and requires `./Toggle.js` from it. Nothing in the server graph that isn't imported from a client module can appear in a client chunk, which is how a Server Component's dependencies stay off the browser.

### Edge cases

- **Render tree vs. module graph.** In the docs' example, `Copyright` is rendered as a child of the Client Component `InspirationGenerator`, yet it's a Server Component: `App` imports and renders it, and it's fully executed before `InspirationGenerator` starts.
- **Exports a Server Component can use.** Values imported from a `'use client'` module must be components or serializable props for a Client Component; any other use throws, as in the first follow-up.
- **Server Functions** go the other way: a client module can import a `'use server'` module and gets references to call.
- **Directive scope.** A `'use client'` file imported from client code is unaffected; the docs say the directive then has no effect.

### Real-world scenario

A product page marked `'use client'` because it has an "Add to cart" button. Every import (the page, the review list, the Markdown renderer for the description) is in the bundle, and the page fetches its data in an Effect. Moving the directive to `AddToCartButton.js` makes the page a Server Component again: it awaits the product, renders the description on the server, and passes `productId` to the button. The bundle shrinks to the button and React, and the reviews can still sit inside a client `<Tabs>` component by being passed as `children`.

### Trade-offs

Every boundary is a serialization point: props crossing it must be serializable, so callbacks can't be passed from server to client unless they're Server Functions. Boundaries placed low keep the bundle small but add more small chunks and more props to design. Not everything belongs on the server: the docs note that a component whose output is much larger than its code, such as one returning a long SVG path, can be cheaper as a Client Component, since then the code is sent instead of the output.
