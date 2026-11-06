---
title: "How are Server Functions called, and what do they expose?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [server-functions, use-server, server-actions, encode-reply, security, progressive-enhancement]
related:
  - react/server-components/rsc-vs-ssr
  - react/server-components/client-boundary
  - react/server-components/rsc-serialization
  - react/forms-and-actions/actions
  - react/forms-and-actions/use-action-state
  - react/forms-and-actions/use-optimistic
  - react/concurrent-rendering/transitions
  - html-and-css/forms-dialog-popover/form-submission
verified: 2026-10
perishable:
  - "Reference rows (`$h`, `bound`) and `$ACTION_ID_` are react-server-dom-webpack 19.3.1's"
  - "Advisory version lists as of the January 26, 2026 update"
  - "RSC bundler APIs don't follow semver within 19.x"
sources:
  - https://react.dev/reference/rsc/use-server#use-server
  - https://react.dev/reference/rsc/use-server#caveats
  - https://react.dev/reference/rsc/use-server#security
  - https://react.dev/reference/rsc/use-server#serializable-parameters-and-return-values
  - https://react.dev/reference/rsc/use-server#server-functions-in-forms
  - https://react.dev/reference/rsc/use-server#calling-a-server-function-outside-of-form
  - https://react.dev/reference/rsc/server-functions#how-do-i-build-support-for-server-functions
  - https://react.dev/reference/rsc/server-functions#creating-a-server-function-from-a-server-component
  - https://react.dev/reference/rsc/server-functions#importing-server-functions-from-client-components
  - https://react.dev/reference/rsc/server-functions#progressive-enhancement-with-useactionstate
  - https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components#vulnerability-overview
  - https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components#immediate-action-required
  - https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components#low-severity-source-code-exposure
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-client/src/ReactFlightReplyClient.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server/src/ReactFlightReplyServer.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server-dom-webpack/src/ReactFlightWebpackNodeLoader.js
tldr: >
  `'use server'` makes async functions callable from the client, which gets only a reference. A call
  encodes the arguments, the framework sends them with the function's id, and the server decodes
  them, runs the function and returns the serialized result. Each is a public endpoint: anyone can
  call it with any arguments, so validate and authorize inside it.
---

## Answer

**Defining.** `'use server'` goes at the top of an async function body or of a module. At module level, every export becomes a Server Function, importable even from client code; inline in a Server Component, the function is passed down as a prop. Only async functions qualify, because every call crosses the network.

**What the client gets** is a reference: an id (module plus export name) and any bound arguments, never the code. React on the client turns it into an async function. Calling it:

1. encodes the arguments with `encodeReply`, in the RSC format with `FormData` added and JSX not allowed;
2. hands the id and encoded arguments to the `callServer` function the framework supplied, so the transport (URL, headers) is the framework's;
3. on the server, `decodeReply` rebuilds the arguments, the framework looks up the function by id and runs it, and the return value is serialized like a prop and decoded on the client as the promise's result.

**Where to call it.** Pass it to `<form action>` or `formAction` (it runs in a Transition, gets the `FormData`, and the form can submit before JavaScript loads) or to `useActionState`; elsewhere, call it inside `startTransition`. Server Functions are for mutations. The docs advise against using them to fetch data: frameworks typically process one call at a time and don't cache results.

**What it exposes.** Each Server Function is a public server endpoint. In the docs' words, arguments "are fully client-controlled": anyone can send any id with any arguments, without your UI. So inside the function, validate every argument, check the logged-in user may perform this action, and escape output. The return value goes to the client, so return only what it needs. Values bound with `.bind`, or captured by an inline Server Function, travel through the client too.

## Example

```jsx
// actions.js
'use server';
export async function renameNote(id, title) {
  console.log('renameNote ran with', id, title);
  return { id, title, savedAt: new Date(0) };
}

// payload for <Editor rename={renameNote} renameSeven={renameNote.bind(null, 7)} />
// → 2:{"id":"file:///…/actions.js#renameNote","bound":null}
// → 3:{"id":"file:///…/actions.js#renameNote","bound":"$@4"}
// → 0:["$","$L1",null,{"rename":"$h2","renameSeven":"$h3"}]
// → 4:[7]

// Client Component; callServer POSTs encodeReply(args) with the id in a header
await rename(7, 'Hello'); // body: [7,"Hello"]
// → { id: 7, title: 'Hello', savedAt: 1970-01-01T00:00:00.000Z }

// The same endpoint, called with no UI at all:
// curl -X POST -H 'rsc-action-id: file:///…/actions.js#renameNote' \
//   --data '[{"admin":true},"<img src=x onerror=alert(1)>"]' http://localhost:…/
// Server log:
// → renameNote ran with { admin: true } <img src=x onerror=alert(1)>
```

`react-server-dom-webpack` 19.3.1 in Node 24, production build. The server ran with `--conditions react-server` and the package's ESM loader, which registered each export of `actions.js` as a server reference. A small HTTP server stood in for the framework, and the client was the package's browser build with a `fetch`-based `callServer`. The forged call reached the function, and its result was sent back.

## Pitfalls

- Trusting arguments because your UI only sends valid ones. The forged request passed an object where an id belonged and markup as a title.
- Checking permissions only in the page that renders the form. The function is reachable without that page; check inside it.
- Closing over or binding secrets. The bound `7` above sat in the payload as row 4, readable in the browser. Some frameworks encrypt captured values; React itself doesn't.
- Calling one during render to load data. The SSR client threw "Server Functions cannot be called during initial render. This would create a fetch waterfall. Try to use a Server Component to pass data to Client Components instead."

## Follow-ups

**Q:** How does a form with a Server Function work before hydration?
**A:** Server rendering gave `<form action="" encType="multipart/form-data" method="POST">` plus a hidden input named `$ACTION_ID_` followed by the id. The browser posts to the current URL; the server's `decodeAction(formData, manifest)` returned the function with the form's fields bound. `useActionState`'s `permalink` sets where to go.

**Q:** What can't be passed as an argument?
**A:** JSX, non-Server Functions, class instances, local symbols and events. A client callback threw "Client Functions cannot be passed directly to Server Functions. Only Functions passed from the Server can be passed back again." in development; production gave minified error #469.

**Q:** Server Action or Server Function?
**A:** The docs called them all Server Actions until September 2024. Now a Server Function is any `'use server'` function; it's a Server Action when passed to an action prop or called inside an Action.

**Q:** What does a Server Function look like on the client?
**A:** The docs show an object with `$$typeof` and `$$id`. In 19.3.1's browser client it was a plain function, named `action` in production and `renameNote` in development; React keeps its id and bound arguments in an internal `WeakMap`.

## Deep dive

### How it works

Implementation details of 19.3.1. On the server, the bundler (here the Node loader) keeps each export of a `'use server'` module as the real function and appends a `registerServerReference` call that tags it: `$$typeof` is `Symbol(react.server.reference)` and `$$id` is the module URL plus `#renameNote`. When `ReactFlightServer` serializes such a function it writes an outlined row `{"id","bound"}` and refers to it with `$h`. Binding a reference with `.bind(null, 7)` keeps it a reference and puts `[7]` in `bound`.

`encodeReply` returns a string for simple arguments (`[7,"Hello"]`) and a `FormData` when parts must be outlined: `[new Date(0), 10n, new Map([['a', 1]]), undefined]` became a field `0` holding `["$D1970-01-01T00:00:00.000Z","$n10","$Q1","$undefined"]` and a field `1` holding the map's entries. `decodeReply` on the server parses that back, resolving references to other Server Functions through the server manifest.

### Real-world scenario

The December 2025 advisories showed that the decoding step itself is attack surface, not only your function's logic.

On December 3, React disclosed CVE-2025-55182, rated CVSS 10.0: "an unauthenticated remote code execution vulnerability in React Server Components", exploiting "a flaw in how React decodes payloads sent to React Server Function endpoints". The post adds: "Even if your app does not implement any React Server Function endpoints it may still be vulnerable if your app supports React Server Components." It was present in 19.0, 19.1.0, 19.1.1 and 19.2.0 of `react-server-dom-webpack`, `react-server-dom-parcel` and `react-server-dom-turbopack`, with a fix introduced in 19.0.1, 19.1.2 and 19.2.1.

On December 11 (updated January 26, 2026), a second post disclosed Denial of Service CVE-2025-55184, CVE-2025-67779 and CVE-2026-23864 (CVSS 7.5) and Source Code Exposure CVE-2025-55183 (CVSS 5.3). It lists 19.0.0 through 19.0.3, 19.1.0 through 19.1.3 and 19.2.0 through 19.2.3 as affected, fixes backported to 19.0.4, 19.1.5 and 19.2.4, and says "Versions 19.0.4, 19.1.5, 19.2.4 are safe." The same post also calls 19.1.4 incomplete. Neither post mentions 19.3.

The source exposure needed a Server Function that stringifies an argument, which then could return "the source code of any Server Function". The post notes that "Secrets hardcoded in source code may be exposed, but runtime secrets such as `process.env.SECRET` are not affected."

### Trade-offs

Server Functions remove the hand-written API layer: a typed function call, progressive enhancement for forms, and results that integrate with Transitions and `useActionState`. The cost is that endpoints become implicit. Every exported function in a `'use server'` file is callable, so a helper exported by accident is a public endpoint, and reviews must treat these files like route handlers. Calls are sequential in typical frameworks and uncached, and frameworks pin exact React versions for the bundler-facing APIs, so security fixes arrive as framework upgrades.
