---
title: "How does a Server Action update the page in a single round trip?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [server-actions, mutations, rsc-payload, revalidation, router]
related:
  - react/server-components/server-functions
  - react/forms-and-actions/actions
  - nextjs/mutations/revalidation-apis-compared
  - nextjs/mutations/server-action-authorization
  - nextjs/mutations/action-errors-and-pending-state
  - nextjs/navigation/client-router-cache-stale-times
  - nextjs/navigation/redirect-and-notfound-control-flow
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
verified: 2026-11
perishable:
  - "Next-Action, Next-Router-State-Tree, x-action-revalidated header names in 16.4.5"
  - "Row 0 fields a, q, i, b, t observed in 16.4.5"
  - "revalidateTag(tag, 'max') skips the action's re-render (16.x)"
  - "revalidatePath in an action refreshes all visited pages (docs: temporary)"
sources:
  - https://nextjs.org/docs/app/guides/server-actions#a-single-response-carries-data-and-ui
  - https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update
  - https://nextjs.org/docs/app/guides/server-actions#sequential-dispatch-on-the-client
  - https://nextjs.org/docs/app/getting-started/mutating-data#refresh-data
  - https://nextjs.org/docs/app/api-reference/functions/revalidatePath#usage
  - https://nextjs.org/docs/app/api-reference/functions/cookies#understanding-cookie-behavior-in-server-functions
  - https://react.dev/reference/rsc/server-functions
tldr: >
  The action is a `POST` to the current URL with a `Next-Action` id header. If it revalidated,
  refreshed, set a cookie or redirected, the server re-renders the current route after running it
  and streams one RSC response: the return value and the new tree together. The router commits both.
  Otherwise only the return value comes back.
---

## Answer

React defines Server Functions: the client holds a reference, arguments go through `encodeReply`, and the framework supplies the transport. Next.js's transport is a `POST` to the **current page's URL** with three headers that matter: `Next-Action` (the action id), `Next-Router-State-Tree` (the segments the client already has) and `Accept: text/x-component`.

On the server, Next.js runs the action, then decides whether the current route must be re-rendered. It does so when the action:

- calls `revalidatePath`, `updateTag` (or the deprecated one-argument `revalidateTag`),
- calls `refresh()`,
- sets or deletes a cookie,
- calls `redirect()` (the destination is rendered instead).

If so, the same response, one Flight stream, carries the action's return value and a fresh RSC payload for the route. The router commits the tree like a navigation; `useActionState` or the awaited promise gets the return value. No second request for the page.

If the action does none of those, or calls `revalidateTag(tag, 'max')`, the response carries only the return value and the page stays as it was.

I ran this on Next.js 16.4.5 with React 19.3.0 (`next build && next start`, Chrome 156 and Firefox 159 agreed), with `cacheComponents` off and on: the same response shape and the same rules in both.

Two Next-specific consequences: actions are dispatched **one at a time** per client (per the docs, not run here), and invalidating calls also empty the browser's router cache, so prefetched pages are fetched again.

## Example

```jsx
// app/rt/actions.js
'use server';
import { revalidatePath } from 'next/cache';
import { bump } from '../../lib/api';
export async function none() { await bump(); return 'ret:none'; }
export async function path() { await bump(); revalidatePath('/rt'); return 'ret:path'; }
// app/rt/page.jsx: static; getV() is a force-cache fetch tagged 'v'
export default async function Page() {
  const { v } = await getV();
  return (
    <main>
      <p id="out">v={v} t={Date.now()}</p>
      <Buttons actions={{ none, path }} />
    </main>
  );
}
// app/rt/buttons.jsx
'use client';
export default function Buttons({ actions }) {
  const [ret, setRet] = useState('');
  const [, start] = useTransition();
  return (
    <div>
      {Object.entries(actions).map(([k, fn]) => (
        <button key={k} onClick={() => start(async () => setRet(await fn()))}>{k}</button>
      ))}
      <p>{ret}</p>
    </div>
  );
}
```

Clicking `none` bumped the data on the API but the page still showed the old `v` and `t`: one `POST /rt`, no `x-action-revalidated` header. Clicking `path` made one `POST /rt` answered with `x-action-revalidated: 1`; the page showed the new `v`, a new `t` and `ret:path`, and the browser made no request for `/rt` afterwards.

## Pitfalls

- Expecting `revalidateTag(tag, 'max')` to update the page you're on. It only marks the tag stale: no re-render in the response, the old value stayed on screen.
- Calling `redirect()` before `revalidatePath` or `updateTag`. `redirect` throws, so the later call never runs and the destination can render stale data.
- Firing actions in parallel with `Promise.all` for speed. Per the docs, the client queues them; do parallel work inside one action.
- Assuming an action that only returns data is "refreshing" the page. Without an invalidating call, the tree isn't in the response.

## Follow-ups

**Q:** What does `redirect()` in an action cost?
**A:** One request. An action that called `updateTag('v')` then `redirect('/other')` made one `POST /rt` (`x-action-revalidated: 1`) and the page switched to `/other` with the new value. No `GET` for `/other` followed; the later `/rt?_rsc` requests were prefetches of its link back.

**Q:** Does `refresh()` show new data?
**A:** Only data that isn't cached. It re-renders the route (`x-action-revalidated: 2`, a new timestamp) but `v`, from a tagged cached fetch, stayed old. Use it when the action changed something outside the cache.

**Q:** Which URL does the `POST` go to?
**A:** The current page's. Any page's URL worked for any action id in my test: the id, not the path, picks the function. The path only decides which route is re-rendered.

## Deep dive

### How it works

The client-side reference holds the action id. On a call, Next's `callServer` sends the encoded arguments with the id and the router state. The request I captured in Chrome (trimmed):

```text
POST /rt
next-action: 0029b9e2e50ad98e248b2b8f8ee440c8327979b156
next-router-state-tree: %5B%22%22%2C%7B%22children%22%3A%5B%22rt%22…
accept: text/x-component
content-type: text/plain;charset=UTF-8
origin: http://localhost:3000
body: []
```

The server looks the id up in its server reference manifest, checks `Origin` against `Host`, decodes the body and runs the function. While it runs, `revalidatePath`, `updateTag`, `refresh` and cookie writes record that the route must be re-rendered. After it returns, Next renders the route for the state tree the client sent and writes everything into one response. For the `path` action (trimmed):

```text
HTTP/1.1 200 OK
x-action-revalidated: 1
Content-Type: text/x-component

0:{"a":"$@1","q":"","i":false,"t":{"t":{"s":"","h":80,"d":{"r":["$","$2","c",…
1:"ret:path"
9:["$","main",null,{"children":[["$","p",null,{"id":"out","children":["v=",14," t=",1794204012984]}],…
```

Row 0 is the envelope: `a` points at row 1, the return value; `t` is the new tree, whose page segment resolves to row 9 with the new `v`. The same action without an invalidating call answered:

```text
0:{"a":"$@1","q":"","i":false,"b":"E69shmJKgqAFGnl71Tc-l"}
1:"ret:none"
```

`b` matched `.next/BUILD_ID`. The header said what kind of update happened: `1` after `revalidatePath`, `updateTag`, one-argument `revalidateTag` or a cookie write; `2` after `refresh()`; absent after `revalidateTag(tag, 'max')` or nothing.

On the client, the router applies the tree as a navigation seeded with data it already has: nothing is fetched for the current route. Because client state lives in the React tree, a re-rendered page keeps its `useState` values (per the docs, not run here).

### Edge cases

- **Router cache.** After `revalidatePath`, `updateTag` and a cookie write, both browsers re-requested the prefetch of a `<Link>` to `/other` (`GET /other?_rsc=…`). After `refresh()` they didn't. The `revalidatePath` docs say an action's call refreshes every previously visited page on its next visit, and call that temporary.
- **Cache Components on.** With `cacheComponents: true`, data from a `use cache` function tagged `v`, and the timestamp in a `<Suspense>` hole, every action gave the same headers and the same visible result as with it off.
- **Errors.** A thrown error comes back as an error row (`1:E{"digest":"…"}`) in the same stream; see the errors question.

### Real-world scenario

A "rename project" form calls an action that writes to the database and calls `revalidateTag('projects', 'max')`. The user saves and still sees the old name until they reload. The `max` profile is stale-while-revalidate: correct for a CMS webhook, wrong for the person who just made the change. `updateTag('projects')` expires the tag, the action's response includes the re-rendered page, and the new name appears with the save.

### Trade-offs

Folding the refresh into the action's response removes a round trip and the window where the UI shows the mutation's result but stale page data. The cost is coupling: the action's response size depends on the route it was called from (a heavy page sends a heavy response), every invalidation clears the router's prefetched pages, and actions queue behind each other. Reads that don't mutate belong in Server Components or a route handler, not in an action.
