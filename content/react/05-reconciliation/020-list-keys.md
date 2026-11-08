---
title: "Why does React need keys, and what goes wrong with index keys?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [keys, lists, reconciliation, index-key, fragment]
related:
  - react/reconciliation/diffing-heuristics
  - react/reconciliation/preserving-and-resetting-state
  - react/rendering-model/jsx-and-elements
  - react/forms-and-actions/controlled-vs-uncontrolled
  - react/concurrent-rendering/fiber
  - browser/the-dom/inserting-and-moving-nodes
verified: 2026-10
sources:
  - https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key
  - https://react.dev/learn/rendering-lists#where-to-get-your-key
  - https://react.dev/learn/rendering-lists#rules-of-keys
  - https://react.dev/learn/rendering-lists#why-does-react-need-keys
  - https://react.dev/reference/react/Fragment#rendering-a-list-of-fragments
  - https://legacy.reactjs.org/docs/reconciliation.html#keys
  - https://legacy.reactjs.org/docs/reconciliation.html#tradeoffs
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactChildFiber.js
tldr: >
  A key is a child's identity among its siblings. React matches old and new children by key, so
  each item keeps its state and DOM node when the list is reordered, filtered or inserted into.
  Index keys follow the position instead: after an insert at the top, typed text and checkboxes
  stay put and pair with the wrong item.
---

## Answer

When a component returns a list, React has to match each new child with one from the last render. It does that by **key**, or by index when there's no key. The match decides which component instance, state and DOM node each item gets.

With stable keys from the data (`key={todo.id}`), React keeps the instance for every key that's still there, moves its DOM node if the order changed, creates nodes only for new keys and removes them only for missing ones. Inserts, deletes and sorts stay cheap and correct.

**Rules:**

- Unique **among siblings** only; the same id in two different lists is fine.
- Stable: generated when the data is created, never during render.
- Not a prop. The component doesn't receive it; reading `props.key` gives `undefined` and a development warning. Pass the id separately: `<Profile key={id} userId={id} />`.
- Missing keys produce the development warning `Each child in a list should have a unique "key" prop.` and React falls back to the index.

**Index keys** tie identity to the position. Insert an item at the top and every existing item shifts to the next key. React re-renders each instance with its new neighbour's props, so the text looks right, but whatever lives in the instance or the DOM stays put: state, uncontrolled input values, a checked box, focus. It now sits next to a different item. Index keys are acceptable only for lists that never reorder, filter, or insert or remove anywhere but the end. An append-only list is safe even with stateful items: existing items keep their index.

**Random keys** (`key={Math.random()}`) never match the previous render, so every item remounts on every render: slow, and typed input is lost.

When each item renders several elements, key a `<Fragment key={id}>`; the `<>` shorthand can't take a key.

## Example

```jsx
function Row({ name }) {
  return <li>{name} <input /></li>;
}

function List({ keyBy }) {
  const [items, setItems] = useState([{ id: 'b', name: 'Bo' }]);
  const add = () => setItems([{ id: 'a', name: 'Ana' }, ...items]);
  return (
    <section>
      <button onClick={add}>add</button>
      <ul>
        {items.map((item, index) => (
          <Row key={keyBy === 'index' ? index : item.id} name={item.name} />
        ))}
      </ul>
    </section>
  );
}
// Render <List keyBy="index" /> and <List keyBy="id" />.
// In each, type "note" next to Bo, then click add:
// keyBy="index" → Ana [note], Bo []
// keyBy="id"    → Ana [], Bo [note]
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted typing and clicks. With index keys, Ana's row got key `0`, the key Bo's row had, so it reused Bo's `<input>` and its text.

## Pitfalls

- Using `index` because the warning went away. The warning is about identity; silencing it with the index keeps the bug.
- Generating keys in render: `key={crypto.randomUUID()}` remounts every item every time. Create the id when the item is created.
- Expecting `props.key` inside the child. It's `undefined`; pass the id as another prop.
- Thinking keys must be globally unique. Duplicates among siblings are the problem: React warns `Encountered two children with the same key` and may duplicate or drop children.

## Follow-ups

**Q:** When is an index key fine?
**A:** When the list is static or only appended to, and is never sorted, filtered, or inserted into or removed from before its end, for example a fixed list of labels or a log that only grows. Item state is safe then, because every existing item keeps its index.

**Q:** Does adding a key outside a list do anything?
**A:** Yes. Changing a component's `key` makes React treat it as a different instance: it unmounts the old one and mounts a fresh one. That's the standard way to reset state on purpose.

**Q:** The data has no id. What then?
**A:** Add one when the data enters the app (a counter, or `crypto.randomUUID()` when the item is created), or use a stable natural key such as a unique slug. Hashing the content works only if the content never changes.

## Deep dive

### How it works

React 19.3.1's `reconcileChildrenArray` (implementation detail, `ReactChildFiber.js`) runs in passes:

1. Walk old and new children together while keys match at the same index, updating in place.
2. If the new list ran out, delete the rest; if the old one ran out, create the rest.
3. Otherwise put the remaining old children in a `Map` by key (by index when unkeyed) and look up each new child there. Matches are reused; leftovers in the map are deleted.

For reused children, `placeChild` tracks `lastPlacedIndex`, the highest old index kept in place so far. A child whose old index is lower is flagged to move; otherwise it stays and raises that mark. The scan only goes forward, so an item moved to the front makes everything after it move. Counting DOM operations with a `MutationObserver` shows the consequence:

```jsx
const list = (items, keyOf) => <ul>{items.map((item, i) => <li key={keyOf(item, i)}>{item}</li>)}</ul>;
const byItem = (item) => item;
const byIndex = (_, index) => index;
flushSync(() => root.render(list(['A', 'B', 'C', 'D'], byItem)));

const observer = new MutationObserver(() => {});
observer.observe(container, { subtree: true, childList: true, characterData: true });
function show(items, keyOf) {
  const before = new Set(container.querySelectorAll('li'));
  flushSync(() => root.render(list(items, keyOf)));
  const records = observer.takeRecords();
  const added = records.flatMap((r) => [...r.addedNodes]);
  const moved = added.filter((node) => before.has(node));
  const textEdits = records.filter((r) => r.type === 'characterData').length;
  console.log(`moved ${moved.map((n) => n.textContent).join('') || '-'}, created ${added.length - moved.length}, text edits ${textEdits}`);
}

show(['B', 'C', 'D', 'A'], byItem); // → moved A, created 0, text edits 0
show(['A', 'B', 'C', 'D'], byItem); // → moved BCD, created 0, text edits 0
show(['A', 'B', 'C', 'D'], byIndex); // → moved -, created 4, text edits 0
show(['D', 'A', 'B', 'C'], byIndex); // → moved -, created 0, text edits 4
show(['D', 'A', 'B', 'C'], () => Math.random()); // → moved -, created 4, text edits 0
```

Chrome 156 and Firefox 159, development and production builds; `container` is the root's DOM node. Moving `A` to the end cost one move; moving it back to the front cost three, because `A`'s old index was the highest. Switching from item keys to index keys remounted everything, since no key matched. With index keys a reorder became four text edits on the same nodes, which is exactly how state ends up on the wrong item.

### Edge cases

- **`key` in development.** React defines a warning getter, so `'key' in props` was `true` in the development build and `false` in production; the value is `undefined` in both. The warning reads ``Item: `key` is not a prop. Trying to access it will result in `undefined` being returned.`` followed by advice to pass a different prop.
- **Keys on Fragments.** `<Fragment key={post.id}><dt>…</dt><dd>…</dd></Fragment>` keys a group without adding a DOM wrapper.
- **Same key, different type** at the same spot still remounts: the key match is checked first, then the type.
- **Keys aren't global.** A keyed item moved to another parent is unmounted and remounted.

### Real-world scenario

A sortable table with an "edit" toggle per row keeps `isEditing` in each row's state. With `key={index}`, sorting by name leaves the editor open on whatever row is now third. With `key={row.id}`, the open editor travels with its row. The same applies to animations and focus: keyed rows keep their DOM nodes, so a focused input stays focused after a sort.

### Trade-offs

Keys hand the reconciler the identity information that a cheap O(n) diff can't infer. The cost is on you: the data needs stable ids, and the algorithm, being forward-only, sometimes moves more nodes than necessary (the "move to front" case). For very long lists, those moves matter less than rendering fewer items in the first place, with virtualization.

## Exercises

### Which box is checked?

```jsx
function Groceries() {
  const [items, setItems] = useState(['milk', 'eggs', 'bread']);
  return (
    <ul>
      {items.map((item, index) => (
        <li key={index}>
          <label><input type="checkbox" /> {item}</label>
          <button onClick={() => setItems(items.filter((i) => i !== item))}>remove</button>
        </li>
      ))}
    </ul>
  );
}
// Check "milk", then click its "remove".
```

**Answer:** The list shows `eggs` and `bread`, with `eggs` checked. Removing `milk` deleted the last `<li>` (key `2`), and the first `<li>`, still key `0` with its checked box, now renders `eggs`. With `key={item}` the checked row is the one removed.
