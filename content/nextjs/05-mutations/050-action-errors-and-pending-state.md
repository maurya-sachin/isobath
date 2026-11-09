---
title: "How do you show errors and pending state for a Server Action form without client JS?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [server-actions, forms, progressive-enhancement, use-action-state, use-form-status, errors]
related:
  - react/forms-and-actions/use-action-state
  - react/forms-and-actions/actions
  - react/forms-and-actions/use-optimistic
  - nextjs/mutations/server-action-single-round-trip
  - nextjs/mutations/server-action-authorization
  - nextjs/app-router/loading-error-not-found-boundaries
  - html-and-css/forms-dialog-popover/form-submission
verified: 2026-11
perishable:
  - "No-JS state travels in $ACTION_1:1 and $ACTION_KEY fields (16.4.5)"
  - "Thrown action errors reach error.js as React error #441 in production"
sources:
  - https://nextjs.org/docs/app/guides/forms#validation-errors
  - https://nextjs.org/docs/app/guides/forms#pending-states
  - https://nextjs.org/docs/app/getting-started/error-handling#server-functions
  - https://nextjs.org/docs/app/getting-started/mutating-data#server-components
  - https://nextjs.org/docs/app/api-reference/file-conventions/error#error
  - https://react.dev/reference/react/useActionState#usage
tldr: >
  Return expected errors from the action and render them from `useActionState`. Without JavaScript
  the form posts normally and the server renders the page with the new state, so the message still
  shows. Pending UI (`useFormStatus`, `isPending`) needs JavaScript; without it the browser's own
  loading is all you get. Thrown errors reach `error.js` only with JS.
---

## Answer

Split errors into two kinds.

**Expected errors** (validation, "name taken") are return values. The action takes `(prevState, formData)` and returns `{ error }`; the form's component calls `useActionState(action, initialState)` and renders `state.error`. Echo the submitted values back too: React resets uncontrolled fields after the action, so `defaultValue={state.name}` keeps what the user typed.

**Pending state** comes from `isPending` (third item of `useActionState`) or `useFormStatus()` in a component inside the form.

Without JavaScript, Next.js renders the form as a real HTML form: `method="POST"`, `encType="multipart/form-data"`, with hidden fields naming the action and carrying the previous state. Submitting does a full-page `POST`; Next.js runs the action, renders the page with the new state and returns HTML. The error message and the echoed input appear as they would with JS. Pending UI can't: no script runs, so `useFormStatus` never reports `true`, and the user sees only the browser's loading indicator.

**Unexpected errors** are thrown. With JavaScript, the nearest `error.js` renders; the message is replaced in production, and `error.digest` matches the server log. Without JavaScript, the response was a bare `500 Internal Server Error` page.

I ran the form below on Next.js 16.4.5 (`next start`, React 19.3.0) with JavaScript on and off in Chrome 156 and Firefox 159; both behaved the same. With JS: one `POST` with a `Next-Action` header returning `text/x-component`; without: one `POST` without it, returning `text/html`.

The hooks themselves are React's; see the `useActionState` and Actions questions.

## Example

```jsx
// app/form/actions.js
'use server';
export async function save(prev, formData) {
  await new Promise((r) => setTimeout(r, 1500));
  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 3) return { error: 'Name must be at least 3 characters', name };
  return { error: null, saved: name, n: (prev.n ?? 0) + 1 };
}
// app/form/save-form.jsx (rendered by app/form/page.jsx)
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { save } from './actions';
function Submit() {
  const { pending } = useFormStatus();
  return <button id="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>;
}
export default function SaveForm() {
  const [state, formAction, isPending] = useActionState(save, { error: null });
  return (
    <form action={formAction}>
      <input id="name" name="name" defaultValue={state.name} />
      <Submit />
      <p id="msg" aria-live="polite">{state.error ?? (state.saved ? `Saved ${state.saved} (${state.n})` : '')}</p>
      <p id="pending">{String(isPending)}</p>
    </form>
  );
}
```

Submitting `Al`, `Ada`, `Bob` with JS: 400 ms in, the button read `Saving…` and was disabled, `isPending` was `true`; then "Name must be at least 3 characters" with `Al` still in the input, "Saved Ada (1)", "Saved Bob (2)". Without JS, the same three messages and the same input value, with no `Saving…` at any point.

## Pitfalls

- Throwing for validation errors. The user gets `error.js` with JS and a bare `500` page without it, instead of a message next to the field.
- Trusting `prevState`. Without JS it comes back from the browser: a forged `$ACTION_1:1` field of `[{"error":null,"n":41}]` produced "Saved Eve (42)".
- Expecting the thrown message on the client. The response row was `1:E{"digest":"4141166017"}`, and `error.js` received "Minified React error #441" with that digest.
- Putting `useFormStatus` in the component that renders the `<form>`. Per React's docs (not run here) it reads only a parent `<form>`, so it belongs in a child like `Submit`.

## Follow-ups

**Q:** How did the previous state survive a full-page post?
**A:** The server-rendered form carried hidden inputs: `$ACTION_REF_1`, `$ACTION_1:0` holding the action id with `"bound":"$@1"`, `$ACTION_1:1` holding the state (`[{"error":null}]`), and `$ACTION_KEY` identifying the hook. The response rewrote `$ACTION_1:1` with the new state.

**Q:** Can you show any pending feedback without JavaScript?
**A:** Not from React. The page is gone until the response arrives; the browser's own progress indicator is the only feedback. Keep actions fast, or accept that pending UI is a JavaScript enhancement.

**Q:** Where does the page go after a no-JS submit?
**A:** It stays on the same URL: the form's `action` is empty, so it posts to the current page. `useActionState`'s third argument, a permalink, changes that target (per React's docs, not run here).
