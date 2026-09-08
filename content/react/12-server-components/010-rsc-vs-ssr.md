---
title: "What are React Server Components, and how do they differ from server rendering?"
status: draft
difficulty: hard
frequency: 5
core: true
tags: [server-components, rsc, rsc-payload, flight, server-rendering, async-components]
related:
  - react/server-rendering/ssr-and-hydration
  - react/server-components/client-boundary
  - react/server-components/rsc-serialization
  - react/server-components/server-functions
  - react/suspense/use-api
  - react/rendering-model/jsx-and-elements
  - react/context-and-composition/context-propagation
verified: 2026-10
perishable:
  - "Payload row format (`I`, `$L`) is react-server-dom-webpack 19.3.1's"
  - "Hooks exported by React's react-server build in 19.3.1"
  - "RSC bundler APIs don't follow semver within 19.x"
sources:
  - https://react.dev/reference/rsc/server-components#server-components-without-a-server
  - https://react.dev/reference/rsc/server-components#server-components-with-a-server
  - https://react.dev/reference/rsc/server-components#adding-interactivity-to-server-components
  - https://react.dev/reference/rsc/server-components#there-is-no-directive-for-server-components
  - https://react.dev/reference/rsc/server-components#async-components-with-server-components
  - https://react.dev/reference/rsc/server-components#how-do-i-build-support-for-server-components
  - https://react.dev/reference/rsc/use-client#advantages
  - https://react.dev/reference/rsc/use-client#limitations
  - https://react.dev/reference/react/useId#caveats
  - https://react.dev/blog/2024/12/05/react-19#server-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react/src/ReactServer.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server/src/ReactFlightServer.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-client/src/ReactFlightClient.js
tldr: >
  Server Components run only on a server, at build time or per request, and are never sent to the
  browser. They can be async and read files or databases. Their output is an RSC payload:
  serialized elements plus references to Client Components, not HTML. Server rendering turns a whole
  tree into HTML for the first load. Apps usually use both.
---

## Answer

A **Server Component** is a component that renders in a separate environment before the client app runs: once at build time, or on a web server per request. It's the default in an RSC app; there's no directive for it (`"use server"` is for Server Functions).

What it can do:

- **Be async** and `await` data: read the filesystem, query a database, use a secret, with no API endpoint in between.
- **Use heavy libraries for free.** Its code and imports never reach the browser, so a Markdown parser used only there adds nothing to the bundle.

What it can't: anything interactive. It has no state, no Effects, no event handlers, and it can't create context. React's server build doesn't even export `useState`; `use`, `useId`, `useMemo` and `useCallback` are allowed. Interactivity comes from **Client Components** (`"use client"`), which it renders and passes props to.

**Output.** Rendering Server Components produces the **RSC payload** (the "Flight" format): the rendered elements as serialized data, with each Client Component replaced by a reference to its module. The client's React reads the payload, loads the referenced modules, and renders those. The Server Component's function itself is never sent.

**Versus server rendering (SSR).** SSR (`react-dom/server`) takes a tree and produces HTML for the first paint; then the client hydrates by running *every* component again. RSC produces a payload, not HTML, and its Server Components never run in the browser, so they never hydrate.

They're complementary: a framework renders Server Components to a payload, then server-renders that payload, Client Components included, to HTML, and ships the payload too so the client can hydrate. On navigation it can fetch a fresh payload instead of a whole new HTML page.

## Example

```jsx
// Post.js, a Server Component: no directive needed
import { readFile } from 'node:fs/promises';
import LikeButton from './LikeButton.js'; // starts with 'use client'

async function Post({ id }) {
  const post = JSON.parse(await readFile('./post.json', 'utf8'));
  return (
    <article>
      <h1>{post.title}</h1>
      <LikeButton postId={id} initialLikes={post.likes} />
    </article>
  );
}

// node --conditions react-server
renderToPipeableStream(<Post id={7} />, clientManifest).pipe(process.stdout);
// → 1:I["./LikeButton.js",["like-button.js"],"default"]
// → 0:["$","article",null,{"children":[["$","h1",null,{"children":"Hello RSC"}],["$","$L1",null,{"postId":7,"initialLikes":3}]]}]

// SSR process (no react-server condition): payload → HTML
const tree = createFromNodeStream(payload, { moduleMap: null, serverModuleMap: null, moduleLoading: null });
renderToPipeableStream(<Root tree={tree} />); // Root returns use(tree)
// → <article><h1>Hello RSC</h1><button>Like post <!-- -->7<!-- --> (<!-- -->3<!-- -->)</button></article>
```

`react-server-dom-webpack` 19.3.1 in Node 24, production build. With no bundler, the client reference was made by hand: `registerClientReference(…, './LikeButton.js', 'default')`, which is what a bundler emits for a `'use client'` import on the server. The `<button>` came from running `LikeButton` (with `useState`) in the SSR process; `Post` ran only in the first.

## Pitfalls

- Saying Server Components are "SSR". SSR is HTML for the first load and hydrates everything; Server Components produce data and never hydrate.
- Marking Server Components with `"use server"`. There's no directive for them; `"use server"` creates Server Functions.
- Calling `useState` or `useEffect` in one. In the react-server build `React.useState` is `undefined`: the render failed with "React.useState is not a function or its return value is not iterable".
- Thinking a Server Component only runs per request. It can run once at build time; the payload and HTML are then static.

## Follow-ups

**Q:** Can a Client Component be async?
**A:** No. The docs say async components aren't supported on the client. A Server Component can start a promise and pass it as a prop; the Client Component reads it with `use`, suspending until it resolves.

**Q:** Can a Server Component use `useId`?
**A:** Yes, in a non-async one: it produced `_S_1_` in the test. The `useId` docs say it can't be used in async Server Components yet.

**Q:** Why do frameworks pin React versions for RSC?
**A:** The docs say Server Components themselves are stable in React 19, but the bundler-facing APIs that implement them don't follow semver and may break between 19.x minors.

## Deep dive

### How it works

The payload is a stream of rows, `id:data`, read by `ReactFlightClient.js`. From the production output above (implementation details of 19.3.1):

- `1:I[…]` is an *import* row: module id, chunks to load, export name. It comes from the client manifest, which maps the reference to the bundler's module.
- Row `0` is the root model. `["$", type, key, props]` is a serialized element; `"$L1"` is a lazy reference to row 1, so `LikeButton`'s element type becomes "whatever module row 1 loads".
- When the decoder hits `$L1`, it calls the bundler runtime (`__webpack_chunk_load__('like-button.js')`, then `__webpack_require__('./LikeButton.js')`). In the test, globals logged both calls before the HTML was produced.

Async Server Components and promises don't block the stream: the server can emit rows for what's ready and send others later, and Suspense boundaries on the client show fallbacks for parts still pending.

The development payload is larger: rows for component names and source locations (`{"name":"Post","env":"Server",…}`), timings, the `readFile` that was awaited, and even a replay of server `console` calls, so DevTools and the browser console can show server work. Elements carry owner and stack references there too: `["$","h1",null,{…},"$1","$7",1]`.

### Edge cases

What React's `react-server` build exports (`ReactServer.js`, 19.3.1), checked by importing it under `--conditions react-server`:

| Available | Missing |
|---|---|
| `use`, `useId`, `useMemo`, `useCallback`, `useDebugValue`, `cache`, `cacheSignal` | `useState`, `useReducer`, `useEffect`, `useRef`, `useContext`, `createContext` |

Errors thrown in a Server Component are sent as rows too. In production the row was `0:E{"digest":""}`: no message, so server details don't leak. Development included the name, message and stack.

Context: a Server Component can't read context and can't create it, but since React 19.3 it can render a `<Context value>` imported from a `'use client'` module.

### Real-world scenario

A documentation site. Each page is a Server Component that reads Markdown from disk, converts it with a large parser and syntax highlighter, and returns plain elements. It runs at build time; the CDN serves HTML plus payload. The only Client Components are a search box and a copy-code button, so the bundle holds those two and React, not the parser. For a comments section that changes per request, the page can run on a server instead, passing a promise of comments to a Client Component that reads it with `use` inside `<Suspense>`.

### Trade-offs

Server Components cut client JavaScript and remove client-server waterfalls: data fetching happens next to the data, in one pass. In exchange you need a bundler and framework that build two module graphs, every prop crossing to a Client Component must be serializable, and any interactive state lives in Client Components. Updates that need fresh Server Component output cost a server round trip. Framework concerns such as routing and caching aren't React's; they belong to the framework (for example the Next.js App Router).
