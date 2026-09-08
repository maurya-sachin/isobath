---
title: "What are Actions, and how does `<form action>` differ from `onSubmit`?"
status: draft
difficulty: medium
frequency: 3
core: true
tags: [actions, form-action, form-action-prop, use-form-status, request-form-reset, transitions, forms]
related:
  - react/concurrent-rendering/transitions
  - react/suspense/error-boundaries
  - react/forms-and-actions/controlled-vs-uncontrolled
  - react/forms-and-actions/use-action-state
  - react/forms-and-actions/use-optimistic
  - react/context-and-composition/context-propagation
  - react/server-components/server-functions
  - html-and-css/forms-dialog-popover/form-submission
  - html-and-css/forms-dialog-popover/button-types-and-form-owner
  - browser/events/default-actions-and-propagation
verified: 2026-10
perishable:
  - "`requestFormReset` has no react.dev reference page (React 19.3.1)"
sources:
  - https://react.dev/blog/2024/12/05/react-19#actions
  - https://react.dev/blog/2024/12/05/react-19#by-convention-functions-that-use-async-transitions-are-called-actions
  - https://react.dev/blog/2024/12/05/react-19#form-actions
  - https://react.dev/blog/2024/12/05/react-19#new-hook-useformstatus
  - https://react.dev/reference/react-dom/components/form#props
  - https://react.dev/reference/react-dom/components/form#caveats
  - https://react.dev/reference/react-dom/components/form#handle-form-submission-with-an-event-handler
  - https://react.dev/reference/react-dom/components/form#handle-form-submission-with-an-action-prop
  - https://react.dev/reference/react-dom/components/form#handle-form-submission-with-a-server-function
  - https://react.dev/reference/react-dom/components/form#handling-form-submission-errors
  - https://react.dev/reference/react-dom/components/form#handling-multiple-submission-types
  - https://react.dev/reference/react-dom/hooks/useFormStatus#returns
  - https://react.dev/reference/react-dom/hooks/useFormStatus#caveats
  - https://react.dev/reference/react-dom/hooks/useFormStatus#pending-is-never-true
  - https://react.dev/reference/react/useTransition#exposing-action-props-from-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/plugins/FormActionEventPlugin.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/shared/ReactDOMFormActions.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberCommitWork.js
tldr: >
  An Action is a function React runs inside a Transition, often async: React tracks its pending
  state and sends errors to an error boundary. `<form action={fn}>` makes submission one: React
  prevents navigation, calls `fn(formData)` in a Transition, exposes pending state through
  `useFormStatus`, and resets uncontrolled fields on success. `onSubmit` is a plain handler where
  you do it all yourself.
---

## Answer

**Action** is React 19's name for a function run inside a Transition, usually async. Because it's a Transition, React knows when it starts and ends: `isPending` stays `true` until it finishes and its state updates commit, a thrown error reaches the nearest error boundary (with `useTransition` or a form action; the standalone `startTransition` reports it as uncaught), and `useOptimistic` and `useActionState` can build on it.

**`<form action={fn}>`** turns a form submission into an Action. On submit, React:

1. cancels the browser's navigation (no `preventDefault` in your code);
2. builds `new FormData(form, submitter)` and calls `fn(formData)` inside `startTransition`;
3. marks the form pending, which children read with `useFormStatus()`;
4. after `fn` completes without throwing, calls `form.reset()`, so uncontrolled fields return to their `defaultValue`. Controlled fields keep their state.

A `<button formAction={fn}>` (or `<input type="submit">`) overrides the form's action for that button. A string `action` or `formAction` is ordinary HTML: the browser submits and navigates.

**`onSubmit`** is just an event handler. You call `e.preventDefault()`, read `new FormData(e.currentTarget)` or your state, track loading and error state yourself, and nothing resets. It runs before React's action handling, and calling `preventDefault()` in it cancels the action. It's still right when you need the event (synchronous validation that blocks submission) or a form library that owns submission.

The `action` prop also accepts a Server Function, which lets a server-rendered form submit before JavaScript loads; `onSubmit` can't.

`useFormStatus()` returns `{ pending, data, method, action }` for the **parent** `<form>`. Call it in the component that renders the form and `pending` is always `false`; it has to be in a child, typically the submit button.

To reset manually, call `requestFormReset(form)` from `react-dom` inside a Transition.

## Example

```jsx
function SaveButton() {
  const { pending } = useFormStatus();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const { title, tag } = ref.current.form.elements;
    console.log(`pending=${pending} title=${title.value} tag=${tag.value}`);
  }, [pending]);
  return <button ref={ref} disabled={pending}>Save</button>;
}

function Editor() {
  const [tag, setTag] = useState('react');
  async function save(formData) {
    console.log('save', formData.get('title'), formData.get('tag'));
    await delay(100);
  }
  return (
    <form action={save}>
      <input name="title" defaultValue="Untitled" />
      <input name="tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      <SaveButton />
    </form>
  );
}
// → pending=false title=Untitled tag=react
// Type "!" at the end of both fields, click Save:
// → save Untitled! react!
// → pending=true title=Untitled! tag=react!
// → pending=false title=Untitled tag=react!
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted clicks and keys. The page didn't navigate. After success, the uncontrolled title went back to its default; the controlled tag kept its state.

## Pitfalls

- Calling `useFormStatus` in the component that renders `<form>`. It stayed `false` while a child's copy was `true`; move it into a child.
- Catching the error inside the action and storing it in state. The action then succeeded, so the form reset and the user's input was gone. Return it through `useActionState` with the submitted values, or make the fields controlled.
- Calling `form.submit()`. It skips the `submit` event, so React never sees it; the form's `action` attribute is a `javascript:` URL that threw "A React form was unexpectedly submitted…". Use `requestSubmit()`.
- Setting state after an `await` in the action without `startTransition`. It commits before the action ends.

## Follow-ups

**Q:** What does `useFormStatus` return while submitting?
**A:** `pending: true`; `data`, the `FormData` being submitted; `method`, the form's `method` property (`'get'` by default, even though a function action is never an HTTP request); and `action`, the function. Between submissions: `false`, `null`, `null`, `null`.

**Q:** What happens if the action throws?
**A:** The error is rethrown while rendering the `<form>`, so the nearest error boundary above it shows its fallback. Development logged "The above error occurred in the <form> component."

**Q:** What if two submissions overlap?
**A:** Plain `<form action>` doesn't queue: the second call started before the first finished, and `pending` stayed `true` until both ended. `useActionState` runs them one at a time.

## Deep dive

### How it works

React handles form submission in its own event plugin. Simplified from React 19.3.1's `FormActionEventPlugin.js` and `ReactFiberHooks.js` (implementation details; `propsOf` stands for an element's current React props):

```js
// runs after your onSubmit listeners for the same submit event
function submitForm() {
  if (nativeEvent.defaultPrevented) return;      // onSubmit cancelled it
  let action = propsOf(form).action;
  let submitter = nativeEvent.submitter;
  if (submitter && propsOf(submitter).formAction != null) {
    action = propsOf(submitter).formAction;
    submitter = null;                           // its name/value isn't sent
  }
  if (typeof action !== 'function') return;      // string: browser submits natively
  nativeEvent.preventDefault();
  const formData = new FormData(form, submitter);
  startHostTransition(form, { pending: true, data: formData, method: form.method, action },
    () => { requestFormReset(form); return action(formData); });
}
```

`startHostTransition` stores the status object as state on the `<form>` element's own fiber and provides it to descendants through an internal context; `useFormStatus` just reads that context. That's why only children see it, the same way a component can't read a context it provides itself.

The reset is requested at the *start*, as a Transition update, so it commits together with the Action's result. During that commit React calls `form.reset()` after all other DOM mutations, so a `defaultValue` that the result just changed is the one restored. Controlled inputs survive because React keeps their `value` attribute equal to the current state, and `reset()` restores the attribute.

### Edge cases

Measured in Chrome 156 and Firefox 159, development and production:

| Situation | Result |
|---|---|
| `onSubmit` without `preventDefault` + `action` | `onSubmit` logged, then the action ran |
| `onSubmit` with `preventDefault` + `action` | The action never ran |
| `onSubmit` with `preventDefault` that calls `startTransition` | `useFormStatus` reported `pending: true`, `action: null` |
| Submit button `name="intent"` with no `formAction` | `intent` was in the `FormData` |
| Same button with a function `formAction` | Dev error: "Cannot specify a "name" prop for a button that specifies a function as a formAction…"; `intent` missing |
| `requestFormReset(form)` in `onSubmit`, no Transition | Form reset, plus dev error "requestFormReset was called outside a transition or action. To fix, move to an action, or wrap with startTransition." |
| `action="target.html"` | Navigated to `target.html?q=react` |

The third row means you can keep an `onSubmit` handler (for a form library, say) and still drive `useFormStatus` and the reset:

```jsx
<form onSubmit={(e) => {
  e.preventDefault();
  const form = e.currentTarget; // currentTarget is null after the await
  startTransition(async () => {
    requestFormReset(form);
    await save(new FormData(form));
  });
}}>
```

### Real-world scenario

A comment box: an uncontrolled `<textarea name="body">` and a `SubmitButton` child that disables itself with `useFormStatus().pending` and shows "Posting…". The action posts the comment and adds it to the list with `startTransition(() => setComments(…))` after the `await`. On success the textarea empties by itself; no `setBody('')`, no `isSubmitting` state, no `preventDefault`. A failed request should not throw into the boundary for an expected validation error. Return it from a `useActionState` action, together with the submitted text to put back as `defaultValue`, because the reset still happens. For instant feedback, `useOptimistic` shows the comment before the server answers.

### Trade-offs

`<form action>` removes boilerplate and, with Server Functions, keeps working before hydration. It assumes uncontrolled fields and the browser's `FormData`: rich client-side validation, field-level error state and complex inputs still need state, a form library, or native constraint validation. `onSubmit` gives full control and works in every React version, at the cost of reimplementing pending, errors and reset. They combine: `onSubmit` for checks that may block, `action` for the work.
