---
title: "When does React keep a component's state, and when does it reset it?"
status: draft
difficulty: hard
frequency: 4
core: true
tags: [state, position, key, remount, ui-tree, nested-components]
related:
  - react/reconciliation/diffing-heuristics
  - react/reconciliation/list-keys
  - react/reconciliation/activity
  - react/rendering-model/rules-of-hooks
  - react/rendering-model/when-components-rerender
  - react/state/structuring-state
  - react/effects/you-might-not-need-an-effect
  - react/effects/effect-cleanup
  - react/concurrent-rendering/fiber
verified: 2026-10
sources:
  - https://react.dev/learn/preserving-and-resetting-state#state-is-tied-to-a-position-in-the-tree
  - https://react.dev/learn/preserving-and-resetting-state#same-component-at-the-same-position-preserves-state
  - https://react.dev/learn/preserving-and-resetting-state#different-components-at-the-same-position-reset-state
  - https://react.dev/learn/preserving-and-resetting-state#option-1-rendering-a-component-in-different-positions
  - https://react.dev/learn/preserving-and-resetting-state#option-2-resetting-state-with-a-key
  - https://react.dev/learn/preserving-and-resetting-state#preserving-state-for-removed-components
  - https://react.dev/reference/react/useState#resetting-state-with-a-key
  - https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactChildFiber.js
tldr: >
  State belongs to a position in the UI tree, not to the JSX tag. React keeps it while the same
  component type renders at the same position with the same key. It's discarded when the
  component is removed, when another type takes that position or a parent's, or when the key
  changes, which is how you reset state on purpose.
---

## Answer

React stores state in its own tree, at the **position** where the component renders ("the first child of the `<div>` that `App` returns"), not in the function or the JSX tag. Each render matches the new element at that position with the old one:

- **Same type, position and key → state is kept**, even if props change.
- **Removed → state is gone.** Rendering it again later starts from the initial state.
- **Different type at that position → reset**, for its whole subtree; that includes an ancestor changing type.
- **Different key → reset**, even with the same type at the same position.

Position means the returned tree, not where JSX sits in your code:

- `{isA ? <Counter name="A" /> : <Counter name="B" />}` keeps the state: one slot, one counter whose props changed.
- `{isA && <Counter name="A" />}{!isA && <Counter name="B" />}` resets it. These are two slots; `false` holds the empty one, so each counter mounts and unmounts.
- Two `return` statements that each put `<Counter />` first in a `<div>` are the same position too.

**Resetting on purpose.** When different data means a different thing, such as a chat with another contact, give the component a key from that identity: `<Chat key={contact.id} contact={contact} />`. A new key unmounts the old subtree and mounts a fresh one: state, DOM and effects start over, all the way down. That replaces an effect that resets state when a prop changes.

**Resetting by accident.** A component *defined inside* another component is a new function, and therefore a new type, on every render of its parent, so its state and DOM are thrown away each time. Define components at the top level.

To keep state for hidden UI, lift it up or hide it with `<Activity>`.

## Example

```jsx
function Counter({ name }) {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{name}: {count}</button>;
}

function App() {
  const [isA, setIsA] = useState(true);
  return (
    <>
      <input type="checkbox" onChange={() => setIsA(!isA)} />
      <p>{isA ? <Counter name="A" /> : <Counter name="B" />}</p>
      <p>{isA && <Counter name="A" />}{!isA && <Counter name="B" />}</p>
      <p>{isA ? <Counter key="A" name="A" /> : <Counter key="B" name="B" />}</p>
    </>
  );
}
// Click each counter twice → A: 2 | A: 2 | A: 2
// Tick the checkbox      → B: 2 | B: 0 | B: 0
// Untick it              → A: 2 | A: 0 | A: 0
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted clicks. The ternary kept one counter at one position. The `&&` version used two positions, and the keyed version two identities; both unmounted the counter they hid, so `A` came back at `0`.

## Pitfalls

- Expecting a changed prop to reset state: `<Chat contact={bob} />` after `<Chat contact={alice} />` keeps Alice's draft. Use `key={contact.id}`.
- Declaring a component inside another. Every parent render gives it a new type: typed text vanishes and its effects re-run on mount.
- Wrapping a component in a new element or provider conditionally. The ancestor's type changes at that position, so everything below remounts.
- Resetting with an effect (`useEffect(() => setDraft(''), [contactId])`). It renders the stale draft first, and doesn't reset nested children's state.

## Follow-ups

**Q:** Does a key change re-run effects?
**A:** Yes. The old instance unmounts, so its effect cleanups run, and the new one mounts and runs its setups. Refs, DOM nodes and focus are new as well.

**Q:** Is state lost when a component re-renders with different props?
**A:** No. Re-rendering never resets state; only unmounting does. `useState(initial)` reads `initial` on mount only.

**Q:** How is this like the Rules of Hooks?
**A:** Same idea one level up: hooks are matched to their state by call order inside a component, and components by position (and key) in the tree. Change the order or the position and the state goes to someone else, or is dropped.

## Deep dive

### How it works

State lives on the component's fiber, React's internal node for that position. When a parent renders, React 19.3.1 reconciles its returned children against the existing child fibers (`ReactChildFiber.js`, implementation detail): for each new element it finds the old fiber with the same key at that slot (both keys `null` when unkeyed), then compares types with `===`. A match clones the fiber, hook state included. A mismatch deletes the old fiber and its subtree, running effect cleanups and removing DOM nodes in the commit, and creates a new fiber with fresh hooks.

Conditionals produce a slot even when they render nothing. `{isA && <Counter />}` leaves `false` in its slot, so the `&&` pair always occupies two slots; whichever counter is showing has a different index from the one before.

### Edge cases

- **Early returns.** `if (big) return <div><Inner />…</div>; return <div><Inner />…</div>;` kept `Inner` mounted across the switch: the structure matches.
- **Fragments.** One Fragment level around a child doesn't change its position; two do (see the Fragment docs' caveat).
- **A key changes the whole subtree.** `key` on a form resets every input inside it, not only the top component's state.
- **Same key, different type** still resets: the key matches but the type doesn't.
- **Keys don't cross parents.** A keyed component moved to a different parent element remounts.

### Real-world scenario

A messaging app renders `<Chat contact={selected} />`. A user types a reply to Alice, clicks Bob, and the half-written message is now addressed to Bob. Adding `key={selected.id}` makes each contact's chat a separate instance, so switching clears the field. If drafts should survive switching, keep them in the parent as `drafts[contactId]`; the key stays, since a chat with Alice is still a different thing from a chat with Bob.

### Trade-offs

Tying state to position makes the default cheap and predictable: re-renders never lose state, and you rarely need ids. The cost is that structure becomes behaviour. Refactoring a conditional from a ternary to two `&&`s, adding a wrapper, or inlining a component definition can silently reset state. Resetting with a key is explicit and complete but remounts the whole subtree, which costs more than adjusting one value; when only one field should change, derive it or adjust it during render instead.

## Exercises

### Why does the input clear?

```jsx
function Form() {
  const [saves, setSaves] = useState(0);

  function NameField() {
    const [name, setName] = useState('');
    useEffect(() => {
      console.log('NameField mounted');
    }, []);
    return <input value={name} onChange={(e) => setName(e.target.value)} />;
  }

  return (
    <>
      <NameField />
      <button onClick={() => setSaves(saves + 1)}>save ({saves})</button>
    </>
  );
}
// Type "Ana", then click save.
```

**Answer:** Typing works, because only `NameField` re-renders. Clicking save re-renders `Form`, which creates a new `NameField` function, a new type at that position. React unmounts the old field and mounts a new one: `NameField mounted` is logged again and the input is a new, empty DOM node. Move `NameField` to the top level.
