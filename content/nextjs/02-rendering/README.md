# 02 — Static, dynamic and prerendered

> **Status:** 🔴 planned · **Published:** 0/6 · **Last verified:** —

What makes a route build-time or request-time: request-time APIs and their async form, Partial Prerendering, `generateStaticParams` and `dynamicParams`, and where `"use client"` goes in a Next.js app.

## Learning goals

After this chapter you can:

- Say what decides whether a route is prerendered at build time or rendered per request
- Explain why `params`, `searchParams`, `cookies()` and `headers()` are async
- Explain what Partial Prerendering puts in the static shell
- Explain how `generateStaticParams` and `dynamicParams` handle paths unknown at build time
- Place `"use client"` in a Next.js page and say what a high boundary costs
- Keep a route static and find what made it dynamic

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Build-time vs request-time rendering decided per route → 010
- Async request APIs: `params`, `searchParams`, `cookies()`, `headers()` → 020
- Partial Prerendering and the static shell → 030
- `generateStaticParams` and `dynamicParams` for unknown paths → 040
- Client boundary placement in a Next.js page → 050
- Keeping a route static and finding the dynamic cause → 060

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What decides whether a route is prerendered at build time or rendered per request?](010-static-or-dynamic-decision.md) | hard | 🟡 draft |
| 020 | [Why are `params`, `searchParams`, `cookies()` and `headers()` async?](020-async-request-apis.md) | medium | 🟡 draft |
| 030 | [What is Partial Prerendering, and what ends up in the static shell?](030-partial-prerendering-shell.md) | hard | 🟡 draft |
| 040 | [How do `generateStaticParams` and `dynamicParams` handle paths unknown at build time?](040-generate-static-params-dynamic-params.md) | medium | 🟡 draft |
| 050 | [Where should `"use client"` go in a Next.js page, and what does a high boundary cost?](050-client-boundary-placement.md) | medium | 🟡 draft |
| 060 | [How do you keep a route static, and how do you find what made it dynamic?](060-keeping-route-static.md) | hard | 🟡 draft |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Caching and prerendering](https://nextjs.org/docs/app/getting-started/caching)
- [Next.js docs — Glossary](https://nextjs.org/docs/app/glossary)
- [Next.js docs — `connection`](https://nextjs.org/docs/app/api-reference/functions/connection)
- [Next.js docs — `generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Next.js docs — Route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Next.js docs — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [react.dev — `"use client"`](https://react.dev/reference/rsc/use-client)
