---
title: "Why is Proxy not enough for authorization?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [proxy, authorization, security, server-actions, route-handlers, matcher]
related:
  - nextjs/mutations/server-action-authorization
  - nextjs/route-handlers-and-proxy/proxy-ts-and-middleware-rename
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - nextjs/mutations/server-action-single-round-trip
  - react/server-components/server-functions
  - nextjs/navigation/prefetch-and-partial-prefetching
verified: 2026-11
perishable:
  - "Action POSTs to a page without the action forwarded internally (16.4.5)"
  - "2026 Proxy bypass advisories fixed in 16.2.5, 16.2.6, 16.2.11"
  - "CVE-2025-29927 fixed in 15.2.3, 14.2.25, 13.5.9, 12.3.5"
sources:
  - https://nextjs.org/docs/app/guides/authentication#optimistic-checks-with-proxy-optional
  - https://nextjs.org/docs/app/guides/authentication#creating-a-data-access-layer-dal
  - https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization
  - https://nextjs.org/docs/app/api-reference/file-conventions/proxy#execution-order
  - https://nextjs.org/docs/app/getting-started/proxy#limitations
  - https://github.com/advisories/GHSA-f82v-jwr5-mffw
  - https://vercel.com/blog/postmortem-on-next-js-middleware-bypass
  - https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f
  - https://github.com/vercel/next.js/security/advisories/GHSA-492v-c6pp-mqqv
  - https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24
tldr: >
  Proxy guards URLs, not data. Its matcher decides coverage, and a Server Action or route handler
  reachable at an unmatched URL runs without it. It only sees the request, so it can't tell whether
  this user owns this record, and routing bugs have bypassed it repeatedly. Use it for optimistic
  redirects; authorize inside every action, handler and data function.
---

## Answer

Three reasons, each of which I could show on Next.js 16.4.5 (`next build && next start`).

**Coverage is a path pattern.** Proxy runs only where `matcher` says, but the things worth protecting aren't paths. A Server Action is a `POST` to whichever page renders it. With `matcher: ['/dashboard/:path*']`, an action used by `/dashboard` and also imported by the public home page ran with no cookie when posted to `/`, while the same call to `/dashboard` got a `307` to `/login`. The docs' own auth matcher excludes `/api`, so every route handler is uncovered unless it checks. The Proxy docs warn that moving an action or editing the matcher "can silently remove Proxy coverage".

**It sees the request, not the resource.** Proxy can tell that a session cookie exists and is validly signed. It can't tell whether user 7 may delete project 42; that needs the record. A database lookup there would run on every matched request, including each `<Link>` prefetch, so the docs limit Proxy to optimistic checks from the cookie.

**It's a routing layer, and routing has bugs.** CVE-2025-29927 (2025) let a request carrying the internal `x-middleware-subrequest` header skip middleware entirely. In 2026, advisories covered prefetch-segment `.rsc` URLs, injected route params and a Turbopack i18n case, each reaching protected content without the check.

So: keep Proxy for redirecting signed-out users and protecting static pages shared by all users (the case the docs give it). Put the real check in a data access layer: every Server Action, route handler and data function verifies the session and authorizes the specific resource. Then a matcher mistake or a routing bug costs a redirect, not data.

## Example

```js
// proxy.js
import { NextResponse } from 'next/server';
export function proxy(request) {
  if (!request.cookies.has('session')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
export const config = { matcher: ['/dashboard/:path*'] };

// app/dashboard/actions.js
'use server';
export async function deleteProject(formData) {
  console.log('[action] deleteProject', formData.get('id'));
  return { deleted: formData.get('id') };
}

// app/page.jsx: public; shows a quick-delete form to signed-in users
import { cookies } from 'next/headers';
import { deleteProject } from './dashboard/actions';
export default async function Home() {
  const signedIn = (await cookies()).has('session');
  return signedIn && <form action={deleteProject}><input name="id" /><button>Delete</button></form>;
}
```

With no cookie, `curl -X POST localhost:3000/dashboard -F '$ACTION_ID_<id>=' -F id=p1` got `307` to `/login`. The same command against `/` got `200`, and the server logged `[action] deleteProject p1`. `GET /api/projects`, outside the matcher, returned the data too.

## Pitfalls

- Copying the docs' matcher `/((?!api|_next/static|_next/image|.*\.png$).*)` and assuming handlers are covered. `/api` is excluded by design.
- Trusting a header Proxy sets, such as `x-user`. A route outside the matcher read `admin` from a client-sent `x-user: admin`; Next.js didn't strip it.
- Treating "has a valid session cookie" as authorization. It says who, not what they may touch, and a revoked session stays valid until the cookie expires unless something checks the store.
- Assuming upgrading closed the class of bug. Five Proxy or middleware bypass advisories were published between May and July 2026.

## Follow-ups

**Q:** Couldn't an attacker post any action id to any public page?
**A:** Not on 16.4.5. While only `/dashboard` used the action, a form-encoded `POST /` got `409 Server Action unavailable`, and one with a `Next-Action` header was forwarded internally to `/dashboard`, re-entering Proxy; neither ran it. Once `/` imported the action, it ran. Coverage depends on where actions are imported.

**Q:** Which versions fixed CVE-2025-29927?
**A:** Per the advisory: 15.2.3, 14.2.25, 13.5.9 and 12.3.5; the workaround was dropping `x-middleware-subrequest` at the edge. On 16.4.5, a request with `x-middleware-subrequest: proxy:proxy:proxy:proxy:proxy` was still redirected by Proxy.

**Q:** Then why have Proxy auth at all?
**A:** UX and static pages. A signed-out user is redirected before any rendering, and a prerendered page shared by all users has no per-request code where a data-layer check could run.
