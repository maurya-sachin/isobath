---
title: "How do you decide where state lives and what not to store?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [lifting-state-up, derived-state, single-source-of-truth, state-structure, props]
related:
  - react/state/use-reducer
  - react/state/immutable-updates
  - react/rendering-model/when-components-rerender
  - react/effects/you-might-not-need-an-effect
  - react/reconciliation/preserving-and-resetting-state
  - react/context-and-composition/context-performance
  - react/forms-and-actions/controlled-vs-uncontrolled
verified: 2026-10
sources:
  - https://react.dev/learn/sharing-state-between-components#lifting-state-up-by-example
  - https://react.dev/learn/sharing-state-between-components#a-single-source-of-truth-for-each-state
  - https://react.dev/learn/choosing-the-state-structure#principles-for-structuring-state
  - https://react.dev/learn/choosing-the-state-structure#avoid-contradictions-in-state
  - https://react.dev/learn/choosing-the-state-structure#avoid-redundant-state
  - https://react.dev/learn/choosing-the-state-structure#don-t-mirror-props-in-state
  - https://react.dev/learn/choosing-the-state-structure#avoid-duplication-in-state
  - https://react.dev/learn/choosing-the-state-structure#avoid-deeply-nested-state
  - https://react.dev/reference/react/useState#parameters
  - https://react.dev/reference/react/useState#storing-information-from-previous-renders
  - https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state
  - https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
tldr: >
  State lives in the closest common parent of every component that reads or changes it; siblings
  that share it get it lifted up and passed down as props. Store only what you can't compute:
  derive values during render, don't copy props into state, keep ids rather than duplicate
  objects, and replace flags that can contradict each other with one status.
---

## Answer

There are two decisions: **where** each piece of state lives, and **whether** it should be state at all.

**Where.** Put state in the closest common parent of every component that reads or changes it. When two siblings need the same value, *lift it up*: move it into their parent and pass down the value plus a callback to change it. Each piece of state then has one owner, a single source of truth. Don't lift higher than needed: an update re-renders the owner's whole subtree. Values that many distant components need can go through context; server data, URL state and form libraries are separate kinds of state with their own tools, and shared stores outside React are read with `useSyncExternalStore`.

**What not to store.** Keep the minimal set of values you can't compute. Before adding a `useState`, ask:

- **Can it be calculated from props or other state?** Compute it during render (`useMemo` only if slow). Don't sync it with an effect.
- **Is it a copy of a prop?** `useState(props.color)` uses the prop only as the initial value and ignores later changes. Read the prop directly, or name it `initialColor` if only the first value matters. To start over when an identity changes, reset with a `key`.
- **Is it duplicated?** Store `selectedId`, not a copy of the selected object, and find the object during render.
- **Can values contradict each other?** Replace `isSending` and `isSent` with one `status: 'typing' | 'sending' | 'sent'`.
- **Do values always change together?** Group them into one object, or a reducer.
- **Is it deeply nested?** Flatten it into objects keyed by id.

The aim is a structure where invalid combinations can't be represented and every change is made in exactly one place.

## Example

```jsx
function Greeting({ name }) {
  const [label] = useState(name);       // copied once, on mount
  const shout = name.toUpperCase();     // derived on every render
  console.log('render', label, shout);
  return <p>{label} / {shout}</p>;
}

function App() {
  const [name, setName] = useState('Ana');
  return (
    <>
      <button onClick={() => setName('Bo')}>Rename</button>
      <Greeting name={name} />
    </>
  );
}
// Mount → render Ana ANA
// Click "Rename" → render Ana BO
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. `Greeting` re-rendered with the new prop, but `label` kept `Ana`: `useState` ignores its argument after the first render. The derived `shout` was right without any extra code.

## Pitfalls

- Syncing derived state with an effect: `useEffect(() => setFullName(first + ' Lee'), [first])`. After a change the component rendered once with `Bo | Ana Lee`, then again with `Bo | Bo Lee`: an extra render that shows inconsistent values.
- Mirroring a prop in state and expecting it to follow the prop. It won't; either use the prop or make the "initial value" intent explicit.
- Storing the selected object next to the list it came from. Edits to the list don't reach the copy; see the exercise.
- Lifting everything to the top "just in case". Each keystroke then re-renders the whole app, and unrelated components become coupled to one owner.

## Follow-ups

**Q:** How do you adjust state when a prop changes, without an effect?
**A:** First try not storing it: derive it. To reset all of a component's state, give it a `key` from the prop. For the rare partial adjustment, keep the previous prop in state and call the setter during render when it differs; React re-renders immediately, before the children.

**Q:** After lifting state up, what makes a child "controlled"?
**A:** Its important information comes from props rather than its own state, so the parent decides what it shows. An uncontrolled component keeps that state locally: simpler to use, harder to coordinate.

**Q:** Isn't calculating in every render wasteful compared to storing it?
**A:** Usually not: string joins and filters over small lists are cheap, and storing means keeping copies in sync. When profiling shows a slow calculation, wrap it in `useMemo`.

## Exercises

### The stale selection

```jsx
function Menu() {
  const [items, setItems] = useState([
    { id: 0, title: 'pretzels' },
    { id: 1, title: 'chips' },
  ]);
  const [selectedItem, setSelectedItem] = useState(items[0]);

  function rename() {
    setItems(items.map((i) => (i.id === 0 ? { ...i, title: 'salted pretzels' } : i)));
  }
  return (
    <>
      <button onClick={rename}>Rename</button>
      <ul>{items.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
      <p>You picked {selectedItem.title}</p>
    </>
  );
}
```

**Answer:** The list shows `salted pretzels`, but the paragraph still says `You picked pretzels`: `selectedItem` holds the old object, and the update created a new one. Store `selectedId` instead and derive `const selectedItem = items.find((i) => i.id === selectedId)` during render.
