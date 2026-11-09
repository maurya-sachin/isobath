# 05 — Mutations and revalidation

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Server Actions as Next.js wires them into forms and pages, the revalidation APIs (`revalidatePath`, `revalidateTag`, `updateTag`, `refresh`), ISR with on-demand revalidation, and the authorization every action needs.

## Learning goals

After this chapter you can:

- Explain how a Server Action updates the page in a single round trip
- Distinguish `revalidatePath`, `revalidateTag`, `updateTag` and `refresh`
- Explain how ISR serves a stale page and what on-demand revalidation does across instances
- Explain why every Server Action must check authorization itself
- Show errors and pending state for a Server Action form without client JavaScript

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Server Action round trip and the page update → 010
- `revalidatePath`, `revalidateTag`, `updateTag`, `refresh` → 020
- ISR stale serving and on-demand revalidation across instances → 030
- Authorization inside every Server Action → 040
- Errors and pending state in action forms without client JS → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does a Server Action update the page in a single round trip?](010-server-action-single-round-trip.md) | hard | 🟡 draft |
| 020 | [What is the difference between `revalidatePath`, `revalidateTag`, `updateTag` and `refresh`?](020-revalidation-apis-compared.md) | hard | 🟡 draft |
| 030 | [How does ISR serve a stale page, and what does on-demand revalidation do across instances?](030-isr-and-on-demand-revalidation.md) | hard | 🟡 draft |
| 040 | [Why must every Server Action check authorization itself?](040-server-action-authorization.md) | hard | 🟡 draft |
| 050 | [How do you show errors and pending state for a Server Action form without client JS?](050-action-errors-and-pending-state.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Mutating data](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Next.js docs — Revalidating](https://nextjs.org/docs/app/getting-started/revalidating)
- [Next.js docs — How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)
- [Next.js docs — Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration)
- [Next.js docs — Forms](https://nextjs.org/docs/app/guides/forms)
- [Next.js docs — Data security](https://nextjs.org/docs/app/guides/data-security)
- [Next.js docs — `revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath)
- [Next.js docs — `revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- [Next.js docs — `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)
- [Next.js docs — `refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh)
- [react.dev — Server Functions](https://react.dev/reference/rsc/server-functions)
