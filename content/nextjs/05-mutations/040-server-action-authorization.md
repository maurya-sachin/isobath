---
title: "Why must every Server Action check authorization itself?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [server-actions, security, authorization, csrf, allowed-origins]
related:
  - react/server-components/server-functions
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/route-handlers-and-proxy/proxy-not-enough-for-auth
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
  - nextjs/deployment/multi-instance-hosting
  - html-and-css/forms-dialog-popover/form-submission
verified: 2026-11
perishable:
  - "allowedOrigins sits under experimental.serverActions in 16.4.5"
  - "Unknown action id: 409 with x-nextjs-action-not-found (16.4.5)"
  - "Action ids cached up to 14 days across builds"
  - "Missing Origin header allowed with a warning (16.4.5)"
sources:
  - https://nextjs.org/docs/app/guides/server-actions#security
  - https://nextjs.org/docs/app/guides/data-security#authentication-and-authorization
  - https://nextjs.org/docs/app/guides/data-security#built-in-server-actions-security-features
  - https://nextjs.org/docs/app/guides/data-security#closures-and-encryption
  - https://nextjs.org/docs/app/guides/data-security#allowed-origins-advanced
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions#allowedorigins
  - https://nextjs.org/docs/app/guides/server-actions#deployment-considerations
  - https://nextjs.org/blog/security-nextjs-server-components-actions
tldr: >
  An action is a `POST` endpoint keyed by an id, not by the page that rendered it. Anyone with the
  id can call it from `curl`, from any route, without the page's checks running. Next.js only checks
  `Origin` against `Host`, limits body size and hides unused ids. So authenticate, authorize the
  specific resource and validate input inside the action.
---

## Answer

Because the page's check doesn't run when the action is called. A page that renders a form only for admins controls **which UI** appears; the action behind the form is a separate entry point. Next.js routes a `POST` to it by the `Next-Action` header (or, from a form posted without JavaScript, a `$ACTION_ID_…` field), and any page URL will do.

I showed this on Next.js 16.4.5 under `next start`. `/admin` rendered "Not allowed" without a session cookie. A `curl` `POST` to `/admin` with the delete action's id and no cookie ran the action and returned its result. The same request sent to `/rt`, a page that never used that action, ran it too.

What Next.js does add:

- **Origin check.** The host in `Origin` must match `Host` or `X-Forwarded-Host`; a mismatch is rejected. `serverActions.allowedOrigins` lists extra hosts (behind a proxy whose host differs). A request with **no** `Origin` header is allowed with a warning, so the check stops browsers on other sites, not scripts. CSRF itself belongs to the Web security topic.
- **Unguessable ids, unused ones stripped.** Ids are hashes; the docs say each is cached for at most 14 days. An action is reachable only if its module is compiled into the server bundle.
- **Encrypted closures.** Values an inline action closes over travel to the client encrypted (per the docs, not run here); `.bind` arguments don't.
- **1 MB body limit** by default (`bodySizeLimit`).

None of that knows who the user is. So inside each action, or a server-only data access layer it calls: authenticate from the session (sessions belong to the Authentication topic), authorize this user for this resource (re-read ownership; don't trust an id or object from the client), validate the input, and return only what the UI needs.

## Example

```jsx
// app/admin/page.jsx
import { cookies } from 'next/headers';
import { deleteAll, deleteAllChecked } from './actions';

export default async function AdminPage() {
  const session = (await cookies()).get('session')?.value;
  if (session !== 'admin') return <p>Not allowed</p>;
  return (
    <>
      <form action={deleteAll}><input name="confirm" defaultValue="yes" /><button>Delete all</button></form>
      <form action={deleteAllChecked}><button>Delete all (checked)</button></form>
    </>
  );
}

// app/admin/actions.js
'use server';
import { cookies } from 'next/headers';

export async function deleteAll(formData) {
  console.log('deleteAll ran, confirm =', formData.get('confirm'));
  return { deleted: 42 };
}

export async function deleteAllChecked(formData) {
  const session = (await cookies()).get('session')?.value;
  if (session !== 'admin') throw new Error('Forbidden');
  console.log('deleteAllChecked ran for', session);
  return { deleted: 42 };
}
```

`curl -X POST localhost:3000/admin -F '$ACTION_ID_<id>=' -F confirm=forged-form`, with the id copied from the form's hidden input on an admin's page, got `200` and the server logged `deleteAll ran, confirm = forged-form`. The same call for `deleteAllChecked` without the cookie got `500` and logged `Error: Forbidden`; with `Cookie: session=admin` it ran.

## Pitfalls

- Treating the page or layout check as the gate. The forged call never ran `/admin`'s check; only code inside the action, or what it calls, did.
- Authorizing the user but not the resource. Checking "logged in" lets one user delete another's post by sending its id.
- Assuming an export nobody renders is private. `unusedExport`, exported from the same `'use server'` file as rendered actions, never appeared in HTML or client chunks, but a `POST` with its id ran it.
- Fixing a proxy mismatch by allowing every origin. `allowedOrigins: ['shop.example']` accepted `shop.example` only; `shop.example:8443` and `app.shop.example` were rejected.

## Follow-ups

**Q:** What did a cross-origin call look like?
**A:** `Origin: https://evil.example` got `500` and the log line "`x-forwarded-host` header with value `localhost:3000` does not match `origin` header with value `evil.example` from a forwarded Server Actions request. Aborting the action."

**Q:** What happens with an id from an older build?
**A:** `409 Conflict` with `x-nextjs-action-not-found: 1`, logged as "Failed to find Server Action … This request might be from an older or newer deployment." A rebuild that kept `.next` produced the same ids, though the docs say a new build regenerates them; deleting `.next` changed every id.

**Q:** Was a module nobody imports reachable?
**A:** No. A `'use server'` file imported nowhere had no entry in `server-reference-manifest.json`, so there was no id to call.

**Q:** Did protocol bugs ever bypass all this?
**A:** Yes. CVE-2025-66478 (December 2025) was remote code execution through React's decoding of action payloads, before any app code ran; the fix was upgrading Next.js.
