---
title: "How does context reach consumers, and why do they all re-render?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [context, create-context, use-context, provider, re-render, memo]
related:
  - react/rendering-model/when-components-rerender
  - react/rendering-model/rules-of-hooks
  - react/context-and-composition/context-performance
  - react/context-and-composition/composition-patterns
  - react/reconciliation/portals
  - react/suspense/use-api
  - react/server-components/client-boundary
  - react/performance/memoization
  - javascript/coercion-and-equality/equality-algorithms
verified: 2026-10
sources:
  - https://react.dev/reference/react/createContext#parameters
  - https://react.dev/reference/react/createContext#provider
  - https://react.dev/reference/react/createContext#consumer
  - https://react.dev/reference/react/useContext#returns
  - https://react.dev/reference/react/useContext#caveats
  - https://react.dev/reference/react/useContext#i-am-always-getting-undefined-from-my-context-although-the-default-value-is-different
  - https://react.dev/reference/react/use#use-context
  - https://react.dev/learn/passing-data-deeply-with-context#before-you-use-context
  - https://react.dev/blog/2024/12/05/react-19#context-as-a-provider
  - https://react.dev/blog/2026/09/09/react-19-3#context-can-be-rendered-directly-in-server-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberNewContext.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberBeginWork.js
tldr: >
  A component reading a context gets the `value` of the nearest `<Context value>` above it, or the
  `createContext` default when there's no provider at all. When a provider's value changes by
  `Object.is`, React re-renders every component below that reads that context, even past
  `memo` components that skipped rendering. Readers can't subscribe to just part of the value.
---

## Answer

`createContext(defaultValue)` returns a context object that holds no value of its own; it's a key that ties providers to readers. A component **provides** a value by rendering `<ThemeContext value={theme}>` (React 19; the older `<ThemeContext.Provider>` still works) and **reads** it with `useContext(ThemeContext)` or `use(ThemeContext)`, which, unlike `useContext`, can be called inside a condition or loop.

The lookup goes **up from the reading component** to the nearest provider of that context:

- Nested providers override outer ones for their subtree, like CSS inheritance.
- A provider rendered by the reading component itself doesn't count; it must be above.
- The default is used **only when there's no provider at all**. `<ThemeContext value={undefined}>` gives readers `undefined`, not the default.

Every component in between is unaffected: context skips the intermediate layers, which is the point, compared with drilling props.

Why every reader re-renders: when the provider renders with a new `value`, React compares it with the previous one using `Object.is`. If it changed, React schedules a render for **every component below that read this context**, wherever it is. That bypasses the usual reasons a subtree is skipped: a `memo` parent whose props didn't change, or elements passed in as `children` that weren't recreated. The reader re-renders as a whole, even if it uses only one field of an object value; there's no built-in way to subscribe to part of it.

Context is a channel, not state. To change what readers see, keep state in the provider's component and pass it as `value`. React's docs suggest passing props or JSX as `children` first, and context when distant parts of the tree need the same data: theme, current user, router.

## Example

```jsx
const Theme = createContext('light');

function Label() {
  const theme = useContext(Theme);
  console.log('Label', String(theme));
  return <p>{String(theme)}</p>;
}

const Panel = memo(function Panel() {
  console.log('Panel');
  return <Label />;
});

function App() {
  const [theme, setTheme] = useState('dark');
  console.log('App');
  return (
    <Theme value={theme}>
      <button onClick={() => setTheme('blue')}>blue</button>
      <Panel />
    </Theme>
  );
}

createRoot(document.getElementById('root')).render(
  <><Label /><Theme value={undefined}><Label /></Theme><App /></>,
);
// Mount → Label light, Label undefined, App, Panel, Label dark
// Click "blue" → App, Label blue
```

Same logs in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, click sent with `element.click()`. The first `Label` has no provider and gets the default; the second gets the explicit `undefined`. On the click, `memo` skipped `Panel`, yet the `Label` inside it re-rendered.

## Pitfalls

- Expecting the default when a provider passes `undefined`, for example state that hasn't loaded yet. The default applies only with no provider above.
- Reading a context in the component that renders its provider. `useContext` sees the provider above it, not the one it returns.
- Putting unrelated data in one context object. Any change re-renders every reader, including those that read an unchanged field.
- Two copies of the module that calls `createContext` (duplicated packages, symlinks). Provider and reader must use the same object by `===`; otherwise readers silently get the default.

## Follow-ups

**Q:** Is `<Context.Provider>` deprecated?
**A:** Not yet. The React 19 post says: "New Context providers can use `<Context>` and we will be publishing a codemod to convert existing providers. In future versions we will deprecate `<Context.Provider>`." In React 19.3.1 it still works without a warning; `Theme.Provider === Theme` is `true` there.

**Q:** When would you use `use(Context)` instead of `useContext`?
**A:** When the read is conditional, such as after an early return. Both find the nearest provider the same way. `use` also reads Promises; that's a separate question.

**Q:** Can a Server Component provide context?
**A:** It can't create or read context. Since React 19.3 it can render a `<Context value>` imported from a `'use client'` module, without a client wrapper component.

**Q:** Does a component between the provider and a reader re-render?
**A:** Not because of context. It renders only for its own reasons, like a parent render; in the example `Panel` didn't.

## Deep dive

### How it works

Implementation details of React 19.3.1, from `ReactFiberBeginWork.js` and `ReactFiberNewContext.js`:

- **A value stack.** When rendering reaches a provider fiber, `pushProvider` saves the context's current value on a stack and sets `context._currentValue` to the provider's `value`. After the subtree is done, `popProvider` restores it. So during the tree walk, the context object always holds the nearest provider's value, and siblings outside the provider see the outer one. With no provider, `_currentValue` is still the default passed to `createContext`.
- **A dependency list.** `useContext` reads `_currentValue` and appends `{ context, memoizedValue }` to the reading fiber's dependency list.
- **Lazy propagation.** A provider doesn't search its subtree eagerly. When React is about to skip a subtree (a bailout with no pending work below), it walks up through the ancestor providers, collects the ones whose `value` changed by `Object.is`, then searches the subtree for fibers with a matching dependency. Each match gets an update lane, and its ancestors get `childLanes` markers, so the walk continues down to it. When a fiber would bail out on its own, React also checks its dependencies' remembered values against the current ones.

That's why `memo` doesn't help: `memo` compares props, but the reader now has its own pending update.

### Edge cases

- **Missing `value` prop.** `<Theme>` without `value` provides `undefined`; development builds log "The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?", even for the new syntax.
- **`<Context.Consumer>`** still exists: `<Theme.Consumer>{(theme) => …}</Theme.Consumer>` reads with a render prop. The docs call it the legacy way.
- **Portals** don't change context: a reader inside a portal still sees providers above the portal in the React tree.
- **Same value.** A provider re-rendering with an `Object.is`-equal value triggers nothing through context: a `memo` reader below it didn't log when the provider's component re-rendered.

### Real-world scenario

A design system nests `<Theme value="dark">` around a sidebar inside a light page. Every `Button` reads `useContext(Theme)`; buttons in the sidebar get `dark`, the rest get the outer value, without any component in between knowing. Toggling the outer theme re-renders the buttons outside the sidebar with the new value. In React 19.3.1 it also re-renders the sidebar's buttons, inside a `memo` sidebar that skipped rendering, though they still read `dark`: the subtree search matches any reader of the context and doesn't stop at the inner provider. The output is correct; only the render count is higher (render logs, Chrome 156 and Firefox 159, development and production builds).

### Trade-offs

Context removes prop drilling at the cost of an implicit dependency: a component's output now depends on where it's rendered, so tests and stories need the provider (a sensible default helps). Updates are coarse, at the granularity of the whole value; when a frequently changing value has many readers, split it, memoize it, or move it to an external store.

## Exercises

### What logs?

```jsx
const Level = createContext(0);

function Section({ children }) {
  const level = useContext(Level);
  console.log('Section sees', level);
  return <Level value={level + 1}>{children}</Level>;
}

function Heading() {
  console.log('Heading', useContext(Level));
  return null;
}

createRoot(document.getElementById('root')).render(
  <Section><Heading /><Section><Heading /></Section></Section>,
);
```

**Answer:** `Section sees 0`, `Heading 1`, `Section sees 1`, `Heading 2`. Each `Section` reads the provider above it (none for the outer one, so the default `0`), then provides one more to its children. Its own provider doesn't affect its own `useContext` call.
