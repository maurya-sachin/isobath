---
title: "When should you use `useReducer` instead of `useState`?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [use-reducer, use-state, reducer, dispatch, actions]
related:
  - react/state/state-as-snapshot
  - react/state/batching-and-updater-functions
  - react/state/immutable-updates
  - react/state/structuring-state
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/when-components-rerender
  - react/context-and-composition/context-performance
  - react/effects/effect-dependencies
verified: 2026-10
sources:
  - https://react.dev/reference/react/useReducer#usereducer
  - https://react.dev/reference/react/useReducer#caveats
  - https://react.dev/reference/react/useReducer#setstate-caveats
  - https://react.dev/reference/react/useReducer#writing-the-reducer-function
  - https://react.dev/reference/react/useReducer#ive-dispatched-an-action-but-the-screen-doesnt-update
  - https://react.dev/reference/react/useReducer#my-entire-reducer-state-becomes-undefined-after-dispatching
  - https://react.dev/reference/react/useReducer#my-reducer-or-initializer-function-runs-twice
  - https://react.dev/learn/extracting-state-logic-into-a-reducer#comparing-usestate-and-usereducer
  - https://react.dev/learn/extracting-state-logic-into-a-reducer#writing-reducers-well
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  When several values change together, or the next state depends on other state, or many handlers
  update the same state in similar ways. A reducer moves that logic into one pure function,
  `(state, action) => next`, that handlers trigger with `dispatch`. Semantics match `useState`:
  snapshots, batching, `Object.is` bail-out, a stable `dispatch`. For simple independent values,
  `useState` is shorter.
---

## Answer

`useReducer(reducer, initialArg, init?)` moves update logic out of event handlers into one pure function, `(state, action) => nextState`. Handlers say *what happened*, `dispatch({ type: 'submitted' })`; the reducer decides *how the state changes*. Everything else works as with `useState`: each render sees a snapshot, dispatches are queued and batched, an unchanged result (by `Object.is`) skips the children, and `dispatch` keeps the same identity across renders.

Reach for a reducer when:

- **Several values change together.** A form's status, error and data move as one: one action updates them consistently, where three setters can leave them disagreeing.
- **The next state depends on other state.** An updater function only sees its own variable; a reducer sees the whole state object.
- **Many handlers make similar updates.** One function is easier to read, log ("which action caused this?") and unit-test without rendering anything.
- **The updater must travel far.** `dispatch` is stable, so it can go through context once and every consumer can send actions without new callbacks each render.

Stay with `useState` for independent, simple values such as a toggle, an input or a counter. The two mix freely in one component, and converting between them is mechanical: `useState` is a reducer whose actions are values or updater functions.

The rules come from where reducers run, which is during rendering:

- Keep them pure: no requests, timeouts or mutation. Strict Mode calls them twice in development.
- Return a new object for a change and the same `state` for a no-op.
- Throw on unknown actions instead of falling through to `undefined`.
- Name actions after interactions (`reset_form`), not field assignments (five `set_field`s).

## Example

```jsx
function formReducer(state, action) {
  console.log('reducer', action.type);
  switch (action.type) {
    case 'submitted': return { status: 'submitting', error: null };
    case 'failed':    return { status: 'error', error: action.error };
    case 'succeeded': return { status: 'success', error: null };
    default: throw new Error(`Unknown action: ${action.type}`);
  }
}

function SignupForm() {
  const [state, dispatch] = useReducer(formReducer, { status: 'idle', error: null });
  console.log('render', state.status);

  async function handleSubmit() {
    dispatch({ type: 'submitted' });
    console.log('dispatched');
    try {
      await saveSignup(); // rejects with Error('Email taken')
      dispatch({ type: 'succeeded' });
    } catch (error) {
      dispatch({ type: 'failed', error: error.message });
    }
  }
  return <button onClick={handleSubmit} disabled={state.status === 'submitting'}>Sign up</button>;
}
// Click → dispatched, reducer submitted, render submitting,
//         then reducer failed, render error
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The reducer ran after `dispatched`, during the render; under Strict Mode in development every line but `dispatched` appeared twice. `status` and `error` can't disagree, because only the reducer writes them.

## Pitfalls

- Mutating `state` in the reducer and returning it. The result is the same object, so React discards the render; see the exercise.
- Side effects in the reducer: fetching, analytics, `localStorage`. They run during render, and twice in Strict Mode development. Do them in the handler that dispatches.
- Returning only part of the state, `return { status: 'error' }`, which drops `error` and anything else. Spread the rest, or return complete states as in the example.
- Expecting `state` to change right after `dispatch`. Like a setter, it only affects the next render.

## Follow-ups

**Q:** What happens when the reducer returns the same state?
**A:** React skips the children. But in React 19.3.1, `dispatch` doesn't pre-compute the result the way `useState`'s setter can, so the component itself renders each time: a no-op action logged `reducer noop` and `render error` on every click while a child stayed silent.

**Q:** Is `useReducer` faster than `useState`?
**A:** No. In React 19.3.1, `useState` updates go through the same code path with a built-in reducer, `typeof action === 'function' ? action(state) : action` (implementation detail). The choice is about where the update logic lives.

**Q:** What is the third argument for?
**A:** `init` computes the initial state once: `useReducer(reducer, userId, createInitialState)` calls `createInitialState(userId)` on mount instead of rebuilding the initial value every render. Strict Mode calls it twice in development.

## Exercises

### The toggle that doesn't toggle

```jsx
function toggleReducer(state, action) {
  if (action.type === 'toggled') {
    state.on = !state.on;
    return state;
  }
  return state;
}

function Toggle() {
  const [state, dispatch] = useReducer(toggleReducer, { on: false });
  console.log('render', state.on);
  return <button onClick={() => dispatch({ type: 'toggled' })}>{state.on ? 'on' : 'off'}</button>;
}
```

**Answer:** Without Strict Mode the first click logs `render true`, yet the button still says `off`: the reducer returned the same object, so `Object.is` found no change and React threw that render's output away. Under Strict Mode in development the reducer runs twice, flips `on` back, and logs `render false`. Fix: `return { ...state, on: !state.on }`.
