---
title: "How do children, render props, compound components, and HOCs compare?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [composition, children, render-props, compound-components, higher-order-components, hooks]
related:
  - react/rendering-model/when-components-rerender
  - react/context-and-composition/context-propagation
  - react/context-and-composition/custom-hooks
  - react/refs/ref-callbacks-and-ref-prop
  - react/reconciliation/preserving-and-resetting-state
  - react/performance/memoization
  - javascript/closures/what-is-a-closure
verified: 2026-10
sources:
  - https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children
  - https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context
  - https://react.dev/reference/react/Children#calling-a-render-prop-to-customize-rendering
  - https://react.dev/reference/react/Children#i-pass-a-custom-component-but-the-children-methods-dont-show-its-render-result
  - https://react.dev/reference/react/cloneElement#passing-data-through-context
  - https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/component-hook-factories
  - https://legacy.reactjs.org/docs/higher-order-components.html#static-methods-must-be-copied-over
  - https://legacy.reactjs.org/docs/higher-order-components.html#dont-use-hocs-inside-the-render-method
  - https://legacy.reactjs.org/docs/hooks-intro.html#its-hard-to-reuse-stateful-logic-between-components
  - https://legacy.reactjs.org/docs/hooks-faq.html#do-hooks-replace-render-props-and-higher-order-components
tldr: >
  `children` and slot props let the caller pass finished elements; render props pass a function the
  component calls with its data; compound components are a set of parts sharing state through
  context; a HOC wraps a component to inject props. Hooks replaced most HOCs and render props that
  only shared logic; the rest still fit UI structure.
---

## Answer

Four answers to "how does a caller customize what a component renders?":

- **`children` and slot props.** The caller passes elements: `<Card>{content}</Card>`, or named slots like `<Layout header={<Header />} sidebar={<Nav />}>`. The component only decides where they go. Since the caller created those elements, a re-render from the wrapper's own state skips them. react.dev suggests it, with plain props, before context. Limit: the wrapper can't pass its data into them.
- **Render props.** A function prop the component calls with its data: `renderItem={(item, isActive) => <Row … />}`, or `children` as a function. Use it when the component owns data the caller's markup needs, such as which row is highlighted. Costs: a new function each render, and nesting when combined.
- **Compound components.** A set of parts used together, like `<Tabs>`, `<Tab>` and `<Panel>`. The parent provides shared state through context and each part reads it, so the caller controls structure and order. Prefer context over `Children.map` plus `cloneElement`, which react.dev calls fragile: they see only the elements passed directly, not what a wrapper component renders.
- **Higher-order components.** `withX(Component)` returns a new component that renders the original with extra props. Problems: extra wrapper layers, prop-name collisions resolved silently, static methods not copied, and a HOC applied during render creating a new component type every time, which remounts and resets state. Refs used to need `forwardRef`; in React 19 `ref` is a prop, so spreading props forwards it.

HOCs aren't deprecated, but the legacy React docs say they "are not commonly used in modern React code". Hooks took over sharing logic. The Hooks FAQ: "Often, render props and higher-order components render only a single child. We think Hooks are a simpler way to serve this use case." Render props, slots and compound components remain the tools for structure.

## Example

```jsx
const TabsContext = createContext(null);

function Tabs({ initial, children }) {
  const [active, setActive] = useState(initial);
  return <TabsContext value={{ active, setActive }}>{children}</TabsContext>;
}

function Tab({ id, children }) {
  const { active, setActive } = useContext(TabsContext);
  return <button aria-pressed={active === id} onClick={() => setActive(id)}>{children}</button>;
}

function Panel({ id, children }) {
  const { active } = useContext(TabsContext);
  return active === id ? children : null;
}

function Profile() { console.log('Profile'); return <p>profile</p>; }
function Billing() { console.log('Billing'); return <p>billing</p>; }

createRoot(document.getElementById('root')).render(
  <Tabs initial="profile">
    <Tab id="profile">Profile</Tab>
    <Tab id="billing">Billing</Tab>
    <Panel id="profile"><Profile /></Panel>
    <Panel id="billing"><Billing /></Panel>
  </Tabs>,
);
// Mount → Profile
// Click "Billing" → Billing
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, clicks sent with `element.click()`. `Tab` and `Panel` re-render through context; `Profile` and `Billing` log only when mounted, because the root created those elements.

## Pitfalls

- Applying a HOC inside a component body: `const Wrapped = withTheme(Counter)` makes a new component type each render, so React remounts it and its state resets.
- Two HOCs injecting the same prop name. The one closest to the component wins without a warning.
- Building compound components with `Children.map` and `cloneElement`. Wrapping a `<Tab>` in a fragment or another component hides it from the parent; context doesn't care how deep a part sits.
- Passing an inline render prop to a `memo` component. The new function each render defeats the comparison.

## Follow-ups

**Q:** Does a HOC still need `forwardRef` in React 19?
**A:** Not for function components. `ref` arrives as an ordinary prop, so `<Component {...props} />` passes it on; a ref on the enhanced component reached the `<input>` inside, in Chrome 156 and Firefox 159.

**Q:** When does a render prop still beat a custom hook?
**A:** When the component owns the markup around the caller's piece: a virtualized list renders the scroll container and calls `renderItem` only for visible rows. A hook returns data; it can't place the caller's JSX inside its structure.

**Q:** Why do compound components usually make the parent a context provider?
**A:** The parts can sit anywhere below it, wrapped in layout or other components, and still read the shared state. React's `cloneElement` page lists context as the alternative to injecting props into children.

## Deep dive

### Edge cases

The HOC problems, run in React 19.3.1 (same output in Chrome 156 and Firefox 159, development and production builds):

```jsx
function withTheme(Component) {
  return function WithTheme(props) { return <Component {...props} theme="dark" />; };
}
function withUser(Component) {
  return function WithUser(props) { return <Component {...props} theme="user-pref" user="ada" />; };
}
function Input({ ref, theme, user }) {
  console.log(theme, user);
  return <input ref={ref} />;
}
Input.validate = () => true;

const Enhanced = withUser(withTheme(Input));
typeof Enhanced.validate;
// → 'undefined'
// <Enhanced ref={ref} /> logs "dark ada"; ref.current is the <input>
```

`withUser`'s `theme` was overwritten by `withTheme`, the inner wrapper, without a warning. Statics stay on the original component unless the HOC copies them.

### Trade-offs

- **`children` and slots** are the simplest and the cheapest to re-render, but data flows only one way: from the caller into the slot.
- **Render props** let the component give data back to the caller's markup, at the cost of callbacks in JSX and nesting.
- **Compound components** give callers control over layout with an implicit contract: parts only work inside their parent, so throw a clear error when the context is missing.
- **HOCs** still fit cross-cutting wrappers that must stay outside a component, such as some library integrations, but each one adds a layer to the tree and hides where props come from. A custom hook does the same logic sharing visibly, inside the component.

## Exercises

### What does the counter show?

```jsx
function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>count {n}</button>;
}

function Parent() {
  const [, force] = useState(0);
  const Wrapped = withTheme(Counter);
  return (
    <>
      <button onClick={() => force((x) => x + 1)}>rerender</button>
      <Wrapped />
    </>
  );
}
// Click "count 0", then click "rerender".
```

**Answer:** `count 0`. The first click shows `count 1`, but re-rendering `Parent` calls `withTheme` again, which returns a new `WithTheme` function. React sees a different component type at that position, unmounts the old one and mounts a fresh `Counter`. Call `withTheme` once, at module level.
