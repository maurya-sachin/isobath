---
title: "What can cross from Server Components to Client Components?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [server-components, client-components, serialization, props, rsc-payload, promises]
related:
  - react/server-components/rsc-vs-ssr
  - react/server-components/client-boundary
  - react/server-components/server-functions
  - react/suspense/use-api
  - react/suspense/suspense-mechanics
  - javascript/json-and-binary-data/json-stringify-edge-cases
  - browser/workers/structured-clone-and-transfer
  - javascript/values-and-types/symbols
verified: 2026-10
perishable:
  - "Payload tags (`$D`, `$W`, `$@`, `$h`) are react-server-dom-webpack 19.3.1's"
  - "Unlisted types the 19.3.1 serializer accepts (FormData, Error, Blob, streams)"
sources:
  - https://react.dev/reference/rsc/use-client#serializable-types
  - https://react.dev/reference/rsc/use-server#serializable-parameters-and-return-values
  - https://react.dev/reference/rsc/server-components#async-components-with-server-components
  - https://react.dev/reference/react/use#streaming-data-from-server-to-client
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-server/src/ReactFlightServer.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-client/src/ReactFlightClient.js
tldr: >
  Props passed to a Client Component are serialized into the RSC payload, a format richer than JSON:
  primitives including `undefined`, `bigint` and `Symbol.for` symbols, arrays, `Map`, `Set`, typed
  arrays, `Date`, plain objects, JSX, Promises (streamed when they settle) and Server Functions.
  Other functions, class instances, null-prototype objects and local symbols make the render throw.
---

## Answer

A Server Component and the Client Components it renders run in different environments, so every prop crossing the boundary is encoded into the RSC payload and rebuilt on the client. React's documented list of serializable props:

- **Primitives:** string, number, bigint, boolean, `undefined`, `null`, and symbols only if registered with `Symbol.for`.
- **Iterables** of serializable values: String, Array, `Map`, `Set`, TypedArray and `ArrayBuffer`.
- **`Date`.**
- **Plain objects** created with object initializers, with serializable properties.
- **Server Functions** (`'use server'`).
- **Elements (JSX)**, of Client or Server Components.
- **Promises.**

Not supported: functions that aren't exported from a client-marked module or marked `'use server'`; classes; instances of any class other than those built-ins, and objects with a null prototype; symbols not registered globally.

**Richer than JSON.** The payload is JSON text with `$`-prefixed tags: `"$D…"` is a `Date`, `"$n10"` a bigint, `"$undefined"`, `"$W2"` a `Set` whose entries are in row 2. `-0`, `NaN` and `Infinity` survive, and an object referenced twice, even cyclically, arrives as one object.

**Promises stream.** React doesn't wait for a promise prop. It writes a placeholder (`"$@3"`), keeps the stream open, and emits row 3 when the promise settles. The client gets a Promise to read with `use` inside `<Suspense>`; a rejection arrives as an error row, with the message hidden in production.

**Functions don't cross,** because a closure can't be sent. Pass a Server Function, which is sent as a reference the client can call, or move the handler into the Client Component. A Client Component itself can be passed, as a reference.

Server Function return values follow the same rules. Their arguments have a slightly different list.

## Example

```jsx
function Page() { // Panel.js has 'use client'; save is a 'use server' function
  return (
    <Panel
      at={new Date(0)}
      tags={new Set(['rsc'])}
      views={10n}
      comments={getComments()} // a Promise; resolves after 50 ms
      onSave={save}
      footer={<small>2026</small>}
    />
  );
}
// → 1:I["./Panel.js",[],"default"]
// → 2:["rsc"]
// → 4:{"id":"./actions.js#save","bound":null}
// → 0:["$","$L1",null,{"at":"$D1970-01-01T00:00:00.000Z","tags":"$W2","views":"$n10","comments":"$@3","onSave":"$h4","footer":["$","small",null,{"children":"2026"}]}]
// 50 ms later:
// → 3:["First!"]

// Client, after createFromNodeStream(payload, …), with Panel's props:
at instanceof Date;  // → true
tags instanceof Set; // → true
typeof views;        // → 'bigint'
await comments;      // → ['First!']
typeof onSave;       // → 'function'
```

`react-server-dom-webpack` 19.3.1 in Node 24, production build; the client and server references were registered by hand, as a bundler would. Rows 1, 2, 4 and 0 were written at once; row 3 only when the promise resolved, on the same open stream.

## Pitfalls

- Passing a callback such as `onClick={() => …}`. The render threw "Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server". Or maybe you meant to call this function rather than return it." Passing a class itself threw the same.
- Passing a class instance (an ORM row, a `Decimal`), `Object.create(null)`, a `RegExp` or a `WeakMap`. Each threw "Only plain objects, and a few built-ins, can be passed to Client Components from Server Components. Classes or null prototypes are not supported." Map it to a plain object.
- Passing an object with `toJSON`, like a `URL`. No error: its `toJSON()` result is sent, so the client gets a string. Development logged "Only plain objects can be passed to Client Components from Server Components. URL objects are not supported."; production said nothing.
- Passing a whole record when the client needs two fields. Every prop is in the payload, readable in the browser.

## Follow-ups

**Q:** What does the client see when a prop can't be serialized?
**A:** The server's `onError` gets the error, and the payload carries an error row in that value's place (`2:E{"digest":""}` in production). Reading that element on the client threw "An error occurred in the Server Components render…", so the nearest error boundary takes over.

**Q:** How is this different from `JSON.stringify` or `structuredClone`?
**A:** JSON drops `undefined`, turns `Map` and `Set` into `{}` and throws on bigint. `structuredClone` copies class instances as plain objects and throws on symbols, functions and Promises. The RSC format keeps those built-ins, refuses class instances, and adds JSX, Promises and Server Functions.

**Q:** Why does `Symbol.for('app.tag')` work but `Symbol('app.tag')` not?
**A:** The payload sends only the registry key (`"$Sapp.tag"`), and the client calls `Symbol.for` with it, getting the same symbol. A local symbol has no key; it threw "Only global symbols received from Symbol.for(...) can be passed to Client Components…".

**Q:** Does the serializer accept anything outside the documented list?
**A:** In 19.3.1, yes: `FormData`, `Error` (message hidden in production), iterators, `Blob`, `ReadableStream` and async iterables. These are implementation details of `ReactFlightServer.js`; the docs list `FormData` only for Server Function arguments.
