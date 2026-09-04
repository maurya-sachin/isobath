---
title: "How does `useOptimistic` show a result before the server confirms it?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [use-optimistic, optimistic-updates, actions, transitions, forms]
related:
  - react/forms-and-actions/actions
  - react/forms-and-actions/use-action-state
  - react/concurrent-rendering/transitions
  - react/suspense/error-boundaries
  - react/state/batching-and-updater-functions
  - react/server-components/server-functions
verified: 2026-10
perishable:
  - "Warning text as printed by React 19.3.1 development builds"
  - "React currently batches all ongoing Transitions together"
sources:
  - https://react.dev/reference/react/useOptimistic#parameters
  - https://react.dev/reference/react/useOptimistic#returns
  - https://react.dev/reference/react/useOptimistic#setoptimistic
  - https://react.dev/reference/react/useOptimistic#setoptimistic-caveats
  - https://react.dev/reference/react/useOptimistic#how-optimistic-state-works
  - https://react.dev/reference/react/useOptimistic#optimistic-state-is-temporary
  - https://react.dev/reference/react/useOptimistic#why-doesnt-this-need-starttransition
  - https://react.dev/reference/react/useOptimistic#choosing-between-updaters-and-reducers
  - https://react.dev/reference/react/useOptimistic#optimistically-adding-to-a-list
  - https://react.dev/reference/react/useOptimistic#optimistic-delete-with-error-recovery
  - https://react.dev/reference/react/useOptimistic#an-optimistic-state-update-occurred-outside-a-transition-or-action
  - https://react.dev/reference/react/useOptimistic#my-optimistic-updates-show-stale-values
  - https://react.dev/reference/react/startTransition#caveats
  - https://react.dev/blog/2024/12/05/react-19#new-hook-optimistic-updates
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  `const [shown, setShown] = useOptimistic(value, reducer?)` returns `value`, except while an Action
  is pending: calling `setShown` inside it renders the guess at once. When the Action ends, the
  optimistic update is dropped and `shown` equals `value` again: in the same commit as the real
  update on success, back to the old `value` on failure.
---

## Answer

`useOptimistic` gives you a temporary value for the duration of an Action. You pass the real value (state or a prop) and get back what to display:

- **No Action pending:** `shown` is just `value`.
- **Inside an Action:** `setShown(guess)` renders the guess immediately, even though the surrounding Transition is still running. With a reducer, `setShown(payload)` calls `reducer(current, payload)`; with a function, it's an updater like `setState`'s.
- **When the Action ends:** React discards the optimistic update. On success, your Action has set the real state (inside `startTransition` after an `await`), so the real value and the guess are replaced in one commit, with no flash. On failure, nothing changed the real state, so the display reverts to the old value.

There is no rollback code to write: reverting is the default, and success means the real state has caught up. You still have to tell the user it failed; catch the error and show a message, or let it reach an error boundary.

The setter must run inside an Action: in `startTransition`, or in a function passed to `<form action>`, `formAction` or another Action prop. Outside one, development logs an error and the value flashes and reverts.

**Reducer form.** For lists, `useOptimistic(items, (current, text) => [...current, { text, pending: true }])` adds pending entries on top of the real list. If the real list changes while the Action is pending, React re-runs the reducer on the new list, so optimistic entries stay on top of the latest data.

It pairs with `useActionState`: the optimistic value hides the queue's wait, while `useActionState` holds the confirmed result. Server-cache libraries such as TanStack Query have their own optimistic APIs.

## Example

```jsx
function LikeButton() {
  const [liked, setLiked] = useState(false);
  const [shownLiked, setShownLiked] = useOptimistic(liked);
  useLayoutEffect(() => console.log(`liked=${liked} shown=${shownLiked}`));
  async function toggle() {
    setShownLiked(!liked);
    try {
      const saved = await saveLike(!liked);
      startTransition(() => setLiked(saved));
    } catch (error) {
      console.log('save failed:', error.message);
    }
  }
  return <form action={toggle}><button>{shownLiked ? 'Liked' : 'Like'}</button></form>;
}
// → liked=false shown=false
// Click (the save succeeds):
// → liked=false shown=true
// → liked=true shown=true
// Click again (the save fails):
// → liked=true shown=false
// → save failed: offline
// → liked=true shown=true
```

`saveLike` resolves with its argument after 100 ms; its second call rejects with `Error('offline')`. Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted clicks. On success the guess and the real value were replaced in one commit; on failure the button went back to "Liked" with no rollback code.

## Pitfalls

- Calling the setter from a plain `onClick`. Development logged "An optimistic state update occurred outside a transition or action. To fix, move the update to an action, or wrap with startTransition.", and the value rendered once, then reverted within 10 ms.
- Forgetting to update the real state. The Action ended, the guess was dropped, and the UI snapped back to `false` although the Action succeeded.
- Setting an absolute guess, such as `setShown(count + 1)` from a stale closure. Use an updater or a reducer so the guess is computed from the current value.
- Treating the revert as error handling. The user sees the value flip back with no explanation; show a message too.

## Follow-ups

**Q:** What happens to the optimistic value if the Action throws?
**A:** The Transition still ends, so it reverts. With the standalone `startTransition`, the test showed the revert and an uncaught error on `window`; with a form action or `useTransition`'s `startTransition`, the error reaches an error boundary instead.

**Q:** How do you know whether an optimistic update is pending?
**A:** Compare `shown !== value`, take `isPending` from `useTransition` or `useActionState`, or mark the guessed items, for example with `pending: true` in the reducer, to style them.

**Q:** Do overlapping Actions revert separately?
**A:** Not in React 19.3.1, which batches ongoing Transitions. Adding `b` (100 ms) and then `c` (200 ms) showed both guesses stacked, and the real list got `b` and `c` together when `c` finished.

## Deep dive

### How it works

From React 19.3.1's `ReactFiberHooks.js` (implementation details): an optimistic setter queues an update with two lanes. Its own lane is the synchronous lane, so it renders right away even though a Transition is in progress. Its *revert lane* is the Transition's lane. While React renders lanes that don't include the revert lane, it applies the update and keeps it in the queue. Once it renders the Transition's lane, which happens when the Action has finished, it skips the update as if it never existed.

Every render starts again from the value you pass in, which React calls the *passthrough*: the queued optimistic updates are replayed on top of it. That's why a reducer sees the latest real list, and why the guess and the confirmed state are replaced in the same commit: both belong to the Transition's lane.

### Edge cases

Stacked guesses, with a reducer:

```jsx
const [shown, addShown] = useOptimistic(items, (current, text) => [...current, `${text}…`]);
async function add(text, wait) {
  addShown(text);
  await delay(wait);
  startTransition(() => setItems((prev) => [...prev, text]));
}
// items = ['a']; startTransition(() => add('b', 100)), then add('c', 200) 30 ms later:
// → items=a shown=a,b…
// → items=a shown=a,b…,c…
// → items=a,b,c shown=a,b,c
```

Chrome 156 and Firefox 159, development and production. `b`'s real update waited for `c`'s Action, because React batched the two ongoing Transitions.
