# 12 — Server Components and Server Functions

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

React Server Components as React defines them, independent of any framework: how they differ from server rendering, the `"use client"` boundary, what crosses it, and calling the server with Server Functions.

## Learning goals

After this chapter you can:

- Explain what a Server Component is and how it differs from server rendering
- Place `"use client"` boundaries and say what they mark
- Say which values can pass from server to client and why
- Explain how a Server Function is called and what it exposes

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Server Components: rendering at build or request time, zero client JS for server-only code, async components, vs server rendering → 010
- The client boundary: `"use client"` marks a module dependency boundary, Server Components passed as `children`, `server-only` → 020
- Serialization: serializable props, the RSC payload, promises streamed to `use`, functions only as Server Functions → 030
- Server Functions: `"use server"`, references sent to the client, calling from forms and transitions, arguments are untrusted input, recent security advisories → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What are React Server Components, and how do they differ from server rendering?](010-rsc-vs-ssr.md) | hard | 🟡 draft |
| 020 | [Where does the client boundary go, and what does `use client` mark?](020-client-boundary.md) | hard | 🟡 draft |
| 030 | [What can cross from Server Components to Client Components?](030-rsc-serialization.md) | hard | 🟡 draft |
| 040 | [How are Server Functions called, and what do they expose?](040-server-functions.md) | hard | 🟡 draft |
<!-- generated:questions:end -->

## Sources

- [react.dev — Server Components](https://react.dev/reference/rsc/server-components)
- [react.dev — `"use client"`](https://react.dev/reference/rsc/use-client)
- [react.dev — `"use server"`](https://react.dev/reference/rsc/use-server)
- [react.dev — Server Functions](https://react.dev/reference/rsc/server-functions)
- [react.dev — `cache`](https://react.dev/reference/react/cache)
- [react.dev — Critical security vulnerability in React Server Components](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
