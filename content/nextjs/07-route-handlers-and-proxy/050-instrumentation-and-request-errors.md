---
title: "What do `instrumentation.ts` and `onRequestError` hook into?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [instrumentation, observability, error-reporting, opentelemetry, proxy, runtimes]
related:
  - nextjs/route-handlers-and-proxy/after-api
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/app-router/loading-error-not-found-boundaries
  - nextjs/mutations/action-errors-and-pending-state
  - nextjs/navigation/redirect-and-notfound-control-flow
  - nextjs/deployment/edge-runtime-deprecation
verified: 2026-11
perishable:
  - "Node `proxy.js` errors skip onRequestError (16.4.5, issue 85261)"
  - "routeType `middleware` renamed `proxy` in 16.0"
  - "`renderType` documented but absent from observed contexts (16.4.5)"
sources:
  - https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#register-optional
  - https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional
  - https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#parameters
  - https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#specifying-the-runtime
  - https://nextjs.org/docs/app/guides/instrumentation#importing-runtime-specific-code
  - https://github.com/vercel/next.js/pull/85006
  - https://github.com/vercel/next.js/issues/85261
tldr: >
  It's a root file with two optional exports. `register()` runs once per server start and per
  runtime, before requests, to set up tracing or SDKs. `onRequestError(error, request, context)`
  receives server errors from pages, route handlers and Server Actions, with the path and a
  `context` naming where it failed. `redirect`, `notFound` and `after` errors don't reach it.
---

## Answer

`instrumentation.js` (or `.ts`) sits at the project root, or in `src/`, not inside `app/`. It is the one place Next.js calls into at the server level rather than per route.

**`register()`** runs once when a server instance starts, and per the docs must finish before requests are handled. That's where OpenTelemetry (`@vercel/otel` or the Node SDK) or an error tracker is initialised. On Next.js 16.4.5, `next start` logged it at boot with no request made, and again after each restart; `next build` never called it. It runs **per runtime**: with an Edge `middleware.js` present, a second `register` logged `edge` on the first request that middleware handled. The file is bundled for both runtimes, so Node-only imports go behind `process.env.NEXT_RUNTIME === 'nodejs'` and a dynamic `import()`.

**`onRequestError(error, request, context)`** (since 15.0) is called when the server catches an error while handling a request:

- `error`: the thrown value; render and action errors carry a `digest`, the id the client gets instead of the message.
- `request`: `{ path, method, headers }`, where `path` includes the query string.
- `context`: `routerKind`, `routePath` (the route file's path), `routeType` (`render`, `route`, `action` or `proxy`), `revalidateReason`, and for renders `renderSource`. The docs also list `renderType`; none of my errors carried it.

It is a reporting hook only: it can't change the response, and it runs on the server, so Client Component errors in the browser need a client-side reporter.

Two gaps I observed: errors thrown in a Node.js `proxy.js` never reached it (an Edge `middleware.js` error did, as `routeType: "proxy"`), and neither did a throwing `after()` callback. Both were only printed to the server log.

## Example

```js
// instrumentation.js
export async function register() {
  console.log('[register]', process.env.NEXT_RUNTIME, new Date().toISOString());
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}

export async function onRequestError(error, request, context) {
  const digest =
    typeof error === 'object' && error !== null && 'digest' in error ? error.digest : undefined;
  console.log('[onRequestError]', JSON.stringify({
    message: error instanceof Error ? error.message : String(error),
    digest,
    method: request.method,
    path: request.path,
    ...context,
  }));
}
```

With a route handler, a page, a Client Component that throws during SSR and a Server Action each throwing, `next start` logged one line per error. The route handler's had no `digest`: `"path":"/api/err?x=1","routerKind":"App Router","routePath":"/api/err","routeType":"route"`. The page's had `"routeType":"render","renderSource":"react-server-components"`, the SSR one `"renderSource":"server-rendering"`, and the action's `"method":"POST","path":"/","routeType":"action","renderSource":"react-server-components-payload"`. With the dynamic import, the build printed no Edge warning.

## Pitfalls

- Expecting `notFound()` or `redirect()` to be reported. They answered `404` and `307` and never reached the hook: they are control flow, not errors.
- Relying on it for Proxy failures. A throwing `proxy.js` returned `500` with no call; issue #85261 reports the same on 16.0.
- Importing Node-only code at the top of the file. The build warned "A Node.js API is used (process.pid …) which is not supported in the Edge Runtime" until the code moved behind the `NEXT_RUNTIME` check.
- Not awaiting the reporter. The docs say to await any async work in the hook (not run here).

## Follow-ups

**Q:** How do you match a user's error report to the server log?
**A:** By `digest`. The action's error reached the client as `1:E{"digest":"4140478798"}`, and `onRequestError` received the same digest with the real message, which the client never sees.

**Q:** What did the Edge middleware error look like?
**A:** `{"routerKind":"Pages Router","routePath":"/proxy","routeType":"proxy"}` from the Edge runtime, in an App Router project. PR #85006 renamed that `routeType` from `middleware` to `proxy` for 16.0.

**Q:** Is `register` a good place for a database pool?
**A:** It can create one, since it runs once per server and runtime, but every server instance gets its own: each `next start` ran `register` again. Size pools per instance.
