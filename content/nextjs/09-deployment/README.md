# 09 — Build output, runtimes and self-hosting

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

What `next build` produces and what runs where under `next start`: Node.js versus the deprecated Edge runtime, self-hosting on several instances, static export and its limits, and how `NEXT_PUBLIC_` variables are inlined at build time.

## Learning goals

After this chapter you can:

- Say what `next build` produces and what runs under `next start`
- Explain why the Edge runtime is deprecated and what it traded away
- Name what breaks when a Next.js app runs on several instances
- Say what `output: 'export'` gives up
- Explain why a `NEXT_PUBLIC_` variable keeps its old value after the environment changes

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- `next build` output and what `next start` runs → 010
- Edge runtime deprecation and its trade-offs → 020
- Multi-instance hosting: what breaks → 030
- `output: 'export'` and what it gives up → 040
- `NEXT_PUBLIC_` inlining at build time → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What does `next build` produce, and what runs where under `next start`?](010-next-build-output.md) | hard | 🟡 draft |
| 020 | [Why is the Edge Runtime deprecated, and what did it trade away?](020-edge-runtime-deprecation.md) | medium | 🟡 draft |
| 030 | [What breaks when you run a Next.js app on several instances?](030-multi-instance-hosting.md) | hard | 🟡 draft |
| 040 | [What does `output: 'export'` give up?](040-output-export-tradeoffs.md) | medium | 🟡 draft |
| 050 | [Why does a `NEXT_PUBLIC_` variable keep its old value after the environment changes?](050-next-public-env-inlining.md) | medium | 🟡 draft |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — `output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Next.js docs — Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js docs — Static exports](https://nextjs.org/docs/app/guides/static-exports)
- [Next.js docs — Route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
- [Next.js docs — Environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js docs — `edge-runtime-deprecated`](https://nextjs.org/docs/messages/edge-runtime-deprecated)
