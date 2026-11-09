---
title: "Why do `redirect()` and `notFound()` throw, and what goes wrong in a `try`/`catch`?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [navigation, redirect, not-found, errors, server-actions, streaming]
related:
  - nextjs/app-router/loading-error-not-found-boundaries
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/mutations/action-errors-and-pending-state
  - nextjs/rendering/partial-prerendering-shell
  - nextjs/navigation/link-click-to-render
verified: 2026-11
perishable:
  - "Digest formats NEXT_REDIRECT;… and NEXT_HTTP_ERROR_FALLBACK;404 in 16.4.5"
  - "unstable_rethrow still unstable in 16.4.5"
  - "Streamed redirect uses meta refresh with 1 s delay (16.4.5)"
sources:
  - https://nextjs.org/docs/app/api-reference/functions/redirect#behavior
  - https://nextjs.org/docs/app/api-reference/functions/redirect#why-does-redirect-use-307-and-308
  - https://nextjs.org/docs/app/api-reference/functions/permanentRedirect
  - https://nextjs.org/docs/app/api-reference/functions/not-found#good-to-know
  - https://nextjs.org/docs/app/api-reference/functions/not-found#calling-notfound-after-streaming-has-started
  - https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow
  - https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes
tldr: >
  They must stop rendering from any depth, so they throw an error whose `digest` (`NEXT_REDIRECT;…`,
  `NEXT_HTTP_ERROR_FALLBACK;404`) Next.js recognises higher up and turns into a 307/308 or a 404.
  A `catch` around the call swallows it: the page renders the catch branch with a 200. Call them
  outside `try`, or `unstable_rethrow(error)` first.
---

## Answer

`redirect()`, `permanentRedirect()` and `notFound()` can be called from a component, a function it awaits, a Server Action or a route handler, any number of calls deep. Throwing is how JavaScript abandons all of that work at once. Their return type is `never`, and what they throw is an `Error` whose `digest` encodes the instruction: `NEXT_REDIRECT;replace;/s;307;` or `NEXT_HTTP_ERROR_FALLBACK;404`. Next.js catches it where it builds the response and acts on the digest.

What that produced on Next.js 16.4.5 under `next start`, with Cache Components on and off alike:

- `redirect('/s')` in a page: `307` with `location: /s`. `permanentRedirect`: `308`. In a route handler: `307`.
- `notFound()`: `404` and `<meta name="robots" content="noindex"/>`.
- After streaming started, inside `<Suspense>`: the status was already sent, so `200`. The redirect came as `<meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/s"/>` plus an error row in the RSC stream; `notFound()` gave `200` with the `noindex` tag.
- In a Server Action called from JavaScript: a `200` RSC response, then a client-side push to `/s`. A form posted without JavaScript got `303` to `/s`.

A `try`/`catch` around the call catches it like any error. Rendering continues in the `catch` block: the page answered `200` with the catch branch's content. Because nothing else in it was dynamic, it was even prerendered that way at build time and served with `Cache-Control: s-maxage=31536000`. In an action, the caught redirect simply returned and the user stayed put.

The fix is to keep the call out of the `try`, or to call `unstable_rethrow(error)` first thing in the `catch`, which rethrows Next.js's own errors and returns for yours.

## Example

```jsx
// app/r/try/page.jsx: the bug
import { redirect } from 'next/navigation';
export default function Page() {
  let caught = 'nothing';
  try {
    redirect('/s');
  } catch (e) {
    caught = `${e.message} | digest=${e.digest}`;
  }
  return <p>{caught}</p>;
}

// app/r/rethrow/page.jsx: the fix
import { redirect, unstable_rethrow } from 'next/navigation';
export default function Page() {
  try {
    redirect('/s');
  } catch (e) {
    unstable_rethrow(e);
    return <p>app error</p>;
  }
}
```

`curl -i /r/try` returned `HTTP/1.1 200 OK` and `<p>NEXT_REDIRECT | digest=NEXT_REDIRECT;replace;/s;307;</p>`. `curl -i /r/rethrow` returned `HTTP/1.1 307 Temporary Redirect` with `location: /s`.

## Pitfalls

- Wrapping a whole data load in `try`/`catch` with `notFound()` inside it. The catch turned the 404 into a `200` page showing the error UI.
- Expecting a `307` when the redirect happens inside `<Suspense>`. Once the shell has streamed, only the meta refresh and the client router can move the user; crawlers see a `200`.
- Calling `redirect()` from an event handler. Per the docs it works during render, in actions and in route handlers; in a handler, use `useRouter().push`.
- Calling `revalidatePath` or `updateTag` after `redirect()` in an action. The throw skips them.

## Follow-ups

**Q:** Is the action redirect a push or a replace?
**A:** A push by default in actions: the caught digest read `NEXT_REDIRECT;push;/s;307;`, and Back from `/s` returned to the form page in Chrome 156 and Firefox 159. In render the digest says `replace`; per the docs, `type` has no effect in Server Components.

**Q:** What does a streamed redirect do without JavaScript?
**A:** With JavaScript disabled in Chrome 156, loading the page fetched `/r/stream` (`200`), then `/s` after the 1-second meta refresh.

**Q:** Why 307 and not 302?
**A:** A 307 keeps the request method, so a redirected `POST` stays a `POST`; a 302 lets browsers switch to `GET`. Form actions use `303` precisely to force the `GET`.
