# 07 — Route handlers, Proxy and request hooks

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Request-level code in Next.js: `route.ts` handlers, `proxy.ts` and why it replaced `middleware`, why Proxy is not an authorization layer, `after` for work that runs after the response, and `instrumentation.ts` for request errors.

## Learning goals

After this chapter you can:

- Choose a route handler or a Server Action for a given job
- Say what `proxy.ts` is for and why `middleware` was renamed
- Explain why Proxy is not enough for authorization
- Explain what `after` runs and when it runs relative to the response
- Say what `instrumentation.ts` and `onRequestError` hook into

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Route handler vs Server Action → 010
- `proxy.ts`, its job and the `middleware` rename → 020
- Proxy is not an authorization layer → 030
- `after` and its timing relative to the response → 040
- `instrumentation.ts` and `onRequestError` → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [When do you write a route handler instead of a Server Action?](010-route-handler-vs-server-action.md) | medium | 🔴 planned |
| 020 | [What is `proxy.ts`, what should run there, and why was `middleware` renamed?](020-proxy-ts-and-middleware-rename.md) | medium | 🔴 planned |
| 030 | [Why is Proxy not enough for authorization?](030-proxy-not-enough-for-auth.md) | hard | 🔴 planned |
| 040 | [What does `after` run, and when does it run relative to the response?](040-after-api.md) | medium | 🔴 planned |
| 050 | [What do `instrumentation.ts` and `onRequestError` hook into?](050-instrumentation-and-request-errors.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Route handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js docs — `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Next.js docs — `proxy.js`](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js docs — `after`](https://nextjs.org/docs/app/api-reference/functions/after)
- [Next.js docs — `instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [Next.js docs — Authentication](https://nextjs.org/docs/app/guides/authentication)
