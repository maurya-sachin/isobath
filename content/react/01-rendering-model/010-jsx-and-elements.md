---
title: "What does JSX compile to, and what is a React element?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [jsx, react-element, jsx-runtime, create-element]
related:
  - react/rendering-model/render-and-commit
  - react/reconciliation/diffing-heuristics
  - react/reconciliation/list-keys
  - javascript/objects-and-properties/freeze-seal-preventextensions
verified: 2026-10
perishable:
  - "React 19.3.1: element.ref still exists in dev, with a warning getter"
  - "$$typeof is Symbol.for('react.transitional.element') since React 19"
sources:
  - https://react.dev/learn/writing-markup-with-jsx#the-rules-of-jsx
  - https://react.dev/reference/react/createElement#returns
  - https://react.dev/reference/react/createElement#caveats
  - https://react.dev/reference/react/createElement#what-is-a-react-element-exactly
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#new-jsx-transform-is-now-required
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#deprecated-element-ref
  - https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
  - https://github.com/facebook/react/blob/v19.3.1/packages/react/src/jsx/ReactJSXElement.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/shared/ReactSymbols.js
  - https://github.com/facebook/react/pull/4832
tldr: >
  JSX compiles to function calls. With the automatic runtime the compiler imports `jsx`/`jsxs`
  from `react/jsx-runtime` and emits `jsx(type, props, key)`, with children inside `props`.
  The call returns a React element: a plain object `{ $$typeof, type, key, props }` that describes
  UI. Creating one doesn't call the component or touch the DOM.
---

## Answer

JSX is syntax, not a React feature. A compiler (Babel, esbuild, SWC, TypeScript) turns every tag into a function call before the code runs.

**The automatic runtime**, required since React 19, adds the import itself and compiles `<Greeting key="g1" name="Ada" />` to `jsx(Greeting, { name: "Ada" }, "g1")`:

- `type` is a string for host tags (`"h1"`) or the component itself for capitalised tags. That's why `<greeting />` means a DOM tag called `greeting`.
- Children go inside `props` as `props.children`. Several static children use `jsxs`, which tells React the array is fixed so it skips the missing-`key` warning.
- `key` is a separate third argument; it never reaches `props`. `ref` is an ordinary prop in React 19.
- Development builds call `jsxDEV` from `react/jsx-dev-runtime`, which adds the source location and a few checks.

The classic transform compiled to `React.createElement(type, props, ...children)`. `createElement` still exists for code written without JSX.

**A React element** is the return value: a plain object describing what to render.

- `$$typeof`: `Symbol.for('react.transitional.element')` in React 19. React renders only objects carrying this tag. A JSON payload can't contain a symbol, so injected data can't pose as an element.
- `type`, `key` (a string or `null`), and `props`.

Creating an element is cheap and does nothing else: the component isn't called and no DOM exists yet. React calls `Greeting` later, during rendering, when it reaches that element in the tree, then compares the elements it returns with the previous ones.

Elements are immutable snapshots. In development React freezes each element and its `props` shallowly; production builds skip the freeze for speed, so mutation goes unnoticed there. To change the UI, render again and return new elements.

## Example

```jsx
function Greeting({ name }) {
  console.log('Greeting called');
  return <h1 className="title">Hello, {name}</h1>;
}

const element = <Greeting key="g1" name="Ada" />;
// compiled: jsx(Greeting, { name: "Ada" }, "g1") from react/jsx-runtime

console.log(element.$$typeof);
// → Symbol(react.transitional.element)
console.log(element.type === Greeting, element.key, element.props);
// → true g1 { name: 'Ada' }

console.log(Object.isFrozen(element), Object.isFrozen(element.props));
// → true true
try {
  element.props.name = 'Grace';
} catch (error) {
  console.log(error.name);
}
// → TypeError

console.log(Greeting(element.props).props);
// → Greeting called
// → { className: 'title', children: [ 'Hello, ', 'Ada' ] }
```

Development build of React 19.3.1, compiled by esbuild 0.28 and run as a module in Node 24. `Greeting called` appears only when `Greeting` is called by hand on the last line. In a production build the freeze check prints `false false`, nothing is thrown, and the last line shows `'Grace'`.

## Pitfalls

- Thinking `<Child />` runs `Child`. It only creates an object; React decides whether and when to call the component.
- Reading `props.key` inside a component. It's `undefined`, and development builds warn that `key` is not a prop; pass the value under another name.
- Mutating `element.props` to "update" a child. Development builds throw in strict code; production builds let it through silently, and React never notices.
- Passing `key` inside a spread: `<div {...props} />` where `props.key` exists. It still becomes the key, but development builds warn that keys must be passed directly to JSX.

## Follow-ups

**Q:** Why does React 19 warn when you read `element.ref`?
**A:** `ref` is now an ordinary prop, read as `element.props.ref`. In development `element.ref` is a getter that logs "Accessing element.ref was removed in React 19. ref is now a regular prop." Production builds still set a plain `ref` field.

**Q:** Why did the symbol change from `react.element` to `react.transitional.element`?
**A:** React 19 changed what an element carries (`ref` moved into `props`). The new tag lets React reject elements made by an older copy of React instead of misreading them: `react-dom/client` 19.3.1 throws "A React Element from an older version of React was rendered."

**Q:** Can you build an element by hand?
**A:** Yes, any object with the right `$$typeof`, `type`, `key` and `props` renders, because elements are plain data. Don't: the shape is an implementation detail, and `jsx` or `createElement` are the supported APIs.

## Exercises

### Where did the key go?

```jsx
const props = { key: 'a', id: 1 };
const element = <div {...props} />;
console.log(element.key, element.props);
```

**Answer:** `a { id: 1 }`. The compiler can't see the key, so it emits `jsx("div", { ...props })`; at runtime `jsx` finds `key` in the config object, moves it to `element.key` and leaves it out of `props`. A development build also warns that a props object containing `key` is being spread into JSX.
