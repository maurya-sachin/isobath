---
title: "Why must React state be updated immutably?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [immutability, object-is, spread, arrays, mutation]
related:
  - react/state/state-as-snapshot
  - react/state/batching-and-updater-functions
  - react/state/use-reducer
  - react/state/structuring-state
  - react/rendering-model/when-components-rerender
  - react/rendering-model/purity-and-strict-mode
  - react/performance/memoization
  - javascript/functional-programming/immutable-updates
  - javascript/coercion-and-equality/equality-algorithms
verified: 2026-10
sources:
  - https://react.dev/learn/updating-objects-in-state#treat-state-as-read-only
  - https://react.dev/learn/updating-objects-in-state#local-mutation-is-fine
  - https://react.dev/learn/updating-objects-in-state#copying-objects-with-the-spread-syntax
  - https://react.dev/learn/updating-objects-in-state#updating-a-nested-object
  - https://react.dev/learn/updating-objects-in-state#write-concise-update-logic-with-immer
  - https://react.dev/learn/updating-objects-in-state#why-is-mutating-state-not-recommended-in-react
  - https://react.dev/learn/updating-arrays-in-state#updating-arrays-without-mutation
  - https://react.dev/learn/updating-arrays-in-state#updating-objects-inside-arrays
  - https://react.dev/reference/react/useState#setstate-caveats
  - https://react.dev/reference/rules/components-and-hooks-must-be-pure#props-and-state-are-immutable
  - https://react.dev/reference/react/useState#ive-updated-the-state-but-the-screen-doesnt-update
tldr: >
  React detects a change by comparing the old and new state with `Object.is`, a reference check;
  it never looks inside objects. Mutate an object and pass it back, and React sees the same
  reference: no render now, a surprise update later, and memoized children that never update.
  Create new objects and arrays along the path to the change instead.
---

## Answer

React decides whether state changed by comparing the new value with the old one using `Object.is`, which for objects and arrays is a reference check. So: treat state as read-only, and to change something, pass the setter a new object or array.

Mutation breaks this in several ways:

1. **No render.** `todo.done = true; setTodos(todos)` passes the same array. React sees no change and drops the update.
2. **Updates appear later, at random.** The mutation stays in the object, so the next unrelated render shows it.
3. **Memoization and effects miss it.** `memo`, `useMemo`, `useCallback` and effect dependencies all compare by reference, so a mutated object looks unchanged. The React Compiler's automatic memoization relies on the same rule of React: props and state are immutable.
4. **The past gets rewritten.** Earlier renders' closures, logged objects and any undo history share the mutated object. Strict Mode's double calls also repeat mutations inside updaters and reducers.

To update, copy everything on the path from the state's root to the change and reuse the rest:

- **Objects:** `{ ...person, name }`. Spread copies one level, so a nested change needs a copy at each level: `{ ...person, address: { ...person.address, city } }`.
- **Arrays:** add with `[...items, item]`, remove with `filter`, replace with `map`, insert with `toSpliced` or slices, sort with `toSorted` or a copy. Avoid `push`, `splice`, `sort`, `reverse` and index assignment on the state array.
- **An object in an array:** `items.map(i => i.id === id ? { ...i, done: true } : i)`.

Mutating something you created in the same handler is fine: `const next = [...items]; next.push(item); setItems(next)` never touches the state.

When nesting gets deep, flatten the state, or use Immer, which lets you write mutating code against a draft and produces the copies for you.

## Example

```jsx
function TodoList() {
  const [todos, setTodos] = useState([{ id: 1, text: 'Milk', done: false }]);
  const [filter, setFilter] = useState('all');
  console.log('render', todos[0].done);

  function markDone() {
    todos[0].done = true;   // mutates the object React holds
    setTodos(todos);        // same array as before
  }
  return (
    <>
      <button onClick={markDone}>Done</button>
      <button onClick={() => setFilter('done')}>Show done</button>
      <p>{todos[0].text}: {todos[0].done ? 'done' : 'to do'}</p>
    </>
  );
}
// Mount → render false
// Click "Done" → no log; the paragraph still says "Milk: to do"
// Click "Show done" → render true; now it says "Milk: done"
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. The fix is `setTodos(todos.map((t) => (t.id === 1 ? { ...t, done: true } : t)))`, which renders on the first click.

## Pitfalls

- Copying only the top level, then mutating a nested object through the copy. The parent re-renders, but anything that compares the nested reference misses the change; see the exercise.
- Sorting or reversing the state array in place: `items.sort()` mutates even when you pass the result to the setter. Use `toSorted()` or sort a copy.
- Mutating inside an updater or reducer. In Strict Mode development it runs twice: a `push` inside an updater once took a list from 2 items to 4.
- Deep-cloning the whole state "to be safe". Every object gets a new identity, so every memoized child and effect sees a change.

## Follow-ups

**Q:** Isn't copying slow?
**A:** Spread copies one level, so an update costs the objects on the changed path, not the whole state; unchanged branches are reused by reference. That reuse is also what makes `Object.is` checks cheap. Huge nested structures are a reason to flatten state.

**Q:** Why does a mutation sometimes show up and sometimes not?
**A:** It shows wherever a component happens to render and read the mutated object. A plain child of a re-rendering parent shows it; a `memo` child receiving the same object reference skips rendering and keeps the old output.

**Q:** Why doesn't React just deep-compare state?
**A:** A deep comparison costs time proportional to the whole structure on every update. With immutable updates, `prev === next` already proves nothing inside changed, so one reference check is enough, and React needs no proxies or property tracking on your objects.

## Exercises

### The half-copied update

```jsx
const Address = memo(function Address({ address }) {
  return <p>{address.city}</p>;
});

function Profile() {
  const [person, setPerson] = useState({ name: 'Ana', address: { city: 'Lima' } });
  function moveToOslo() {
    const next = { ...person };
    next.address.city = 'Oslo';
    setPerson(next);
  }
  return (
    <>
      <button onClick={moveToOslo}>Move</button>
      <h1>{person.address.city}</h1>
      <Address address={person.address} />
    </>
  );
}
```

**Answer:** After a click the heading says `Oslo` and the paragraph still says `Lima`. `next` is a new object, so `Profile` re-renders, but `next.address` is the same object as before, now mutated. `Address` receives an identical reference and `memo` skips it. Copy the nested level too: `setPerson({ ...person, address: { ...person.address, city: 'Oslo' } })`.
