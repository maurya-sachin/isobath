---
title: "Why does a `NEXT_PUBLIC_` variable keep its old value after the environment changes?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [environment-variables, next-public, build-time, inlining, self-hosting]
related:
  - nextjs/deployment/next-build-output
  - nextjs/deployment/multi-instance-hosting
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/client-boundary-placement
verified: 2026-11
perishable:
  - "Turbopack inlines process.env[constKey]; webpack doesn't (16.4.5)"
  - "NEXT_PUBLIC_ references inlined in server bundles too"
sources:
  - https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser
  - https://nextjs.org/docs/app/guides/environment-variables#runtime-environment-variables
  - https://nextjs.org/docs/app/guides/environment-variables#environment-variable-load-order
  - https://nextjs.org/docs/app/guides/self-hosting#environment-variables
  - https://nextjs.org/docs/app/api-reference/functions/connection
tldr: >
  Because it no longer exists as a variable. `next build` replaces every `process.env.NEXT_PUBLIC_X`
  with the build-time value as a string literal, in client and server bundles alike, so changing the
  environment at `next start` changes nothing. Runtime values must be read on the server during a
  dynamic render and passed down as props.
---

## Answer

`NEXT_PUBLIC_` is an instruction to the compiler, not a runtime feature. During `next build`, every reference spelled `process.env.NEXT_PUBLIC_X` is replaced with the value from the build environment. Browsers have no `process.env`, so a literal in the JavaScript is the only way the value can reach them.

On Next.js 16.4.5 I built with `NEXT_PUBLIC_X=a SECRET=s1` and started with `NEXT_PUBLIC_X=b SECRET=s2`:

- **Client chunk**: the source `dotted: process.env.NEXT_PUBLIC_X` was `dotted:"a"` in `.next/static/chunks/*.js`. No rebuild, no change.
- **Server bundle**: also inlined. A dynamic Server Component printed `x: "a"`; the built code read `{x:"a",secret:process.env.SECRET`.
- **Non-prefixed variables** stay real lookups on the server: the same dynamic page printed `SECRET` as `s2`, and a `.env` value edited between build and start was read fresh.
- **Static pages** freeze everything. The prerendered `/` showed `a`, `s1` and the old `.env` value, because it ran once, at build.

Only the literal `process.env.NAME` form is replaced. Destructuring (`const { NEXT_PUBLIC_X } = process.env`) and a key held in a prop stayed runtime lookups: `b` in the server render, `undefined` in Chrome 156 and Firefox 159.

So one image promoted from staging to production carries staging's public values. The fix the docs give is to keep per-environment values on the server: read them in a dynamically rendered Server Component (`await connection()`, or any request API, makes it per request) and pass them to Client Components as props, or serve them from your own endpoint. Otherwise, build once per environment.

## Example

```jsx
// app/client.jsx
'use client';
const name = 'NEXT_PUBLIC_X';
export default function Client({ fromServer, envKey }) {
  const { NEXT_PUBLIC_X: destructured } = process.env;
  const v = { dotted: process.env.NEXT_PUBLIC_X, computed: process.env[name], destructured,
    byProp: process.env[envKey], secret: process.env.SECRET };
  return <pre>{JSON.stringify({ ...v, fromServer })}</pre>;
}

// app/dyn/page.jsx
import { connection } from 'next/server';
import Client from '../client';
export default async function Page() {
  await connection();
  return <Client fromServer={process.env.SECRET} envKey="NEXT_PUBLIC_X" />;
}

// NEXT_PUBLIC_X=a SECRET=s1 next build && NEXT_PUBLIC_X=b SECRET=s2 next start
// server HTML: {"dotted":"a","computed":"a","destructured":"b","byProp":"b","secret":"s2","fromServer":"s2"}
// browser:     {"dotted":"a","computed":"a","fromServer":"s2"}
// webpack server HTML: "computed":"b"; browser drops computed too
```

`JSON.stringify` drops `undefined`, so the browser line shows which reads survived. Only `fromServer`, a prop serialized from a per-request render, carries the runtime value to the browser.

## Pitfalls

- Expecting a restart or a new container env to change a public value. The literal is in the shipped files; only a rebuild changes it.
- Reading a server variable in a Client Component. The server render printed `"secret":"s2"` into the HTML, then the browser rendered `undefined`. The value leaked and the markup disagreed.
- Trusting the docs' "dynamic lookups are not inlined" for constant keys. Turbopack turned `process.env[name]` with `const name = 'NEXT_PUBLIC_X'` into `"a"`; `--webpack` left it a lookup.
- Reading runtime config in a static page. Without a request API or `connection()`, it ran at build and kept build values.

## Follow-ups

**Q:** Are `.env` files read by `next start`?
**A:** Yes. A dynamic page saw a `.env` value edited after the build, while the prerendered page kept the old one. Real environment variables win over `.env.production.local`, `.env.local`, `.env.production` and `.env`, in that order.

**Q:** Is a `NEXT_PUBLIC_` value a secret?
**A:** Never. It is a plain string in every client chunk that references it; anyone can read it.

**Q:** Does this matter with several instances?
**A:** Built once, they all carry the same literals, which is the goal. Built per instance with different environments, they disagree, on top of the build-ID and action-key differences.
