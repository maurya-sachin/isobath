# 10 — Forms and Actions

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

Handling input and submissions: controlled and uncontrolled inputs, Actions as async transitions, `<form action>`, `useFormStatus`, `useActionState`, and optimistic updates with `useOptimistic`.

## Learning goals

After this chapter you can:

- Choose between controlled and uncontrolled inputs and fix the common warnings
- Explain what an Action is and what `<form action>` does differently from `onSubmit`
- Track pending state and results with `useFormStatus` and `useActionState`
- Show an optimistic result with `useOptimistic` and say how it reverts

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Controlled vs uncontrolled: `value` vs `defaultValue`, switching between them, caret jumps with async updates → 010
- Actions: async functions in transitions, `<form action>`, `formAction`, form reset after success, `useFormStatus` → 020
- `useActionState`: action signature, previous state, pending flag, progressive enhancement with a permalink → 030
- `useOptimistic`: optimistic state during a transition, reverting on finish or error → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What is the difference between controlled and uncontrolled inputs?](010-controlled-vs-uncontrolled.md) | medium | 🟡 draft |
| 020 | [What are Actions, and how does `<form action>` differ from `onSubmit`?](020-actions.md) | medium | 🟡 draft |
| 030 | [How does `useActionState` manage a form's result and pending state?](030-use-action-state.md) | medium | 🔴 planned |
| 040 | [How does `useOptimistic` show a result before the server confirms it?](040-use-optimistic.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [react.dev — `<input>`](https://react.dev/reference/react-dom/components/input)
- [react.dev — `<form>`](https://react.dev/reference/react-dom/components/form)
- [react.dev — `useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus)
- [react.dev — `useActionState`](https://react.dev/reference/react/useActionState)
- [react.dev — `useOptimistic`](https://react.dev/reference/react/useOptimistic)
- [react.dev — React 19](https://react.dev/blog/2024/12/05/react-19)
