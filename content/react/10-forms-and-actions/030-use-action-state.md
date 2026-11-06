---
title: "How does `useActionState` manage a form's result and pending state?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [use-action-state, actions, forms, is-pending, use-form-state, permalink]
related:
  - react/forms-and-actions/actions
  - react/forms-and-actions/use-optimistic
  - react/state/use-reducer
  - react/concurrent-rendering/transitions
  - react/suspense/error-boundaries
  - react/suspense/suspense-mechanics
  - react/server-components/server-functions
  - react/server-rendering/ssr-and-hydration
verified: 2026-10
perishable:
  - "React currently batches multiple ongoing Actions together"
  - "`ReactDOM.useFormState` still exported, logging a rename error, in 19.3.1"
sources:
  - https://react.dev/reference/react/useActionState#parameters
  - https://react.dev/reference/react/useActionState#returns
  - https://react.dev/reference/react/useActionState#caveats
  - https://react.dev/reference/react/useActionState#reduceraction-caveats
  - https://react.dev/reference/react/useActionState#how-useactionstate-queuing-works
  - https://react.dev/reference/react/useActionState#useactionstate-vs-usereducer
  - https://react.dev/reference/react/useActionState#cancelling-queued-actions
  - https://react.dev/reference/react/useActionState#use-with-a-form
  - https://react.dev/reference/react/useActionState#handling-errors
  - https://react.dev/reference/react/useActionState#action-cannot-read-form-data
  - https://react.dev/reference/react/useActionState#actions-skipped
  - https://react.dev/reference/react/useActionState#async-function-outside-transition
  - https://react.dev/reference/rsc/server-functions#progressive-enhancement-with-useactionstate
  - https://react.dev/blog/2024/12/05/react-19#new-hook-useactionstate
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  `const [state, dispatch, isPending] = useActionState(action, initialState)` keeps the result of an
  Action as state. Each `dispatch(payload)` calls `action(previousState, payload)`, and its return value
  becomes the next state. Calls are queued and run one at a time. Pass `dispatch` to `<form action>`
  to get `FormData` as the payload; elsewhere call it inside `startTransition`.
---

## Answer

`useActionState` is `useReducer` for side effects: the reducer may be async, talk to a server, and its return value is the new state. It returns `[state, dispatch, isPending]`; a third argument, `permalink`, is optional.

- **`action(previousState, payload)`** receives the last result (initially `initialState`) and whatever you passed to `dispatch`. As a form action, the payload is the `FormData`, so the signature is `(prevState, formData)`, not `(formData)`.
- **`state`** is the latest returned value: a result, an error message, the submitted values to show again.
- **`isPending`** is `true` from the first dispatch until every queued call has finished and the result is committed.
- **`dispatch`** must run in a Transition. `<form action={dispatch}>` and `formAction` do that for you; from a click handler, wrap it in `startTransition`.

**Queued, in order.** Each call needs the previous result, so React runs dispatches one at a time. Three quick submissions ran back to back, each receiving the previous return value. Use `useOptimistic` when the user shouldn't wait for the queue, or plain `useTransition` when calls are independent and may run in parallel.

**Errors.** A thrown error cancels everything still queued and goes to the nearest error boundary. For expected failures, such as validation, return an error state instead.

**`permalink`** only matters with a Server Function on a server-rendered page: if the form is submitted before JavaScript has loaded, the browser goes to that URL, and React passes the state through when the same form renders there. After hydration it does nothing.

`useActionState` replaces `ReactDOM.useFormState` from the Canary releases. React 19.3.1 still exports the old name; using it logs a rename error in development.

## Example

```jsx
async function addToCart(prevCount, formData) {
  console.log(`run prev=${prevCount}`);
  await delay(100);
  return prevCount + Number(formData.get('qty'));
}

function Cart() {
  const [count, dispatch, isPending] = useActionState(addToCart, 0);
  useLayoutEffect(() => console.log(`commit count=${count} isPending=${isPending}`));
  return (
    <form action={dispatch}>
      <input type="hidden" name="qty" value="1" />
      <button>Add</button>
      <p>{count} in cart</p>
    </form>
  );
}
// → commit count=0 isPending=false
// Click Add three times quickly:
// → run prev=0
// → commit count=0 isPending=true
// → run prev=1
// → run prev=2
// → commit count=3 isPending=false
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted clicks. The runs started 100 ms apart, each after the previous one resolved. Counts 1 and 2 were never committed: React batched the ongoing Actions and committed once, at the end.

## Pitfalls

- Writing the action as `(formData) => …`. The first argument is the previous state, so `formData.get` throws a `TypeError`.
- Calling `dispatch` from `onClick` without `startTransition`. Development logged "An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly)…", and the component suspended: the nearest `<Suspense>` fallback replaced it until the action finished.
- Throwing for validation errors. Queued calls are dropped and the form is replaced by the error boundary's fallback; return `{ error }` instead.
- Expecting the form to keep the user's input on an error result. The form action still succeeded, so uncontrolled fields reset.

## Follow-ups

**Q:** How do you keep the user's input when the action returns an error?
**A:** Return the submitted values in the state and use them as `defaultValue`. React resets the form in the commit that applies the new state, after updating `defaultValue`, so the reset restores the returned value. In the test, the email came back and the other field emptied.

**Q:** How is it different from `useReducer`?
**A:** `useReducer`'s reducer must be pure and runs during rendering; `useActionState`'s action runs in a Transition, may be async, and has side effects. React doesn't call it twice in Strict Mode.

**Q:** Can you reset the state?
**A:** There's no reset function. Handle a reset payload in the action, or remount the component with a new `key`.

## Deep dive

### How it works

From React 19.3.1's `ReactFiberHooks.js` (implementation details): the hook keeps a queue of dispatched calls. `dispatch` appends a node and, if the queue was empty, runs the action immediately inside a new Transition; otherwise the node waits. When an action's promise resolves, its value becomes the queue's state and the next node runs with it. If one rejects, every remaining node is rejected with the same error, and the hook ignores later dispatches.

Each node is also a thenable, and the hook's state points to the latest one. The component reads it like `use(promise)`: inside a Transition React keeps the old UI on screen while it's pending, which is why `count` stayed `0` until the queue drained. Outside a Transition there's nothing to keep the old UI, so the component suspends, which is the fallback in the second pitfall. A synchronous action outside a Transition is fine: it updated immediately with no warning.

### Edge cases

Calling the old name logs, in development: "ReactDOM.useFormState has been renamed to React.useActionState. Please update Legacy to use React.useActionState." (`Legacy` is the component's name). It still works in 19.3.1.

Dispatching three calls where the first throws:

```jsx
const [state, dispatch] = useActionState(async (prev, n) => {
  console.log(`run ${n}`);
  await delay(50);
  if (n === 1) throw new Error('boom');
  return n;
}, 0);
// in a click handler:
startTransition(() => { dispatch(1); dispatch(2); dispatch(3); });
// → run 1
```

The error boundary showed "boom"; calls 2 and 3 never ran. Chrome 156 and Firefox 159, development and production.

For long queues, an `AbortController` per call lets the action check `signal.aborted` and return early, which the docs show for a quantity stepper.
