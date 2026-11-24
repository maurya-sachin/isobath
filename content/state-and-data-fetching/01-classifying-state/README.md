# 01 — Classifying state

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

Local, shared, server, URL and form state: what each one is, where it should live, and how to derive values instead of storing them twice.

## Learning goals

After this chapter you can:

- Sort any piece of state into local, shared, server, URL or form, and say why
- Explain why copying server data into a client store creates a second source of truth
- Decide when state belongs in the URL and what sharing or reloading then costs
- Explain where form input lives while typing and where it goes after submit
- Recognise when a global store is the wrong tool and name what replaces it

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Local, shared, server, URL and form state, and where each lives → 010
- Derived state instead of stored copies → 010, 020
- Server data copied into a client store → 020
- URL as state (shareable, reload-safe, back-button aware) → 030
- Form state while typing vs after submit → 040
- Global store as the wrong default → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How do you decide whether a piece of state is local, shared, server, URL or form state?](010-classify-state-kind.md) | medium | 🔴 planned |
| 020 | [Why is server data copied into a client store a bug waiting to happen?](020-server-data-copied-into-store.md) | medium | 🔴 planned |
| 030 | [When should state live in the URL, and what does that cost?](030-state-in-url.md) | medium | 🔴 planned |
| 040 | [Where should form state live while the user types, and where after submit?](040-form-state-lifecycle.md) | medium | 🔴 planned |
| 050 | [When is a global store the wrong answer, and what replaces it?](050-when-global-store-is-wrong.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [React — Managing state](https://react.dev/learn/managing-state)
- [React — Choosing the state structure](https://react.dev/learn/choosing-the-state-structure)
- [React — Sharing state between components](https://react.dev/learn/sharing-state-between-components)
