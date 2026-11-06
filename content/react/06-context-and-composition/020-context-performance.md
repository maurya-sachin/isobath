---
title: "How do you stop context changes from re-rendering too much?"
status: draft
difficulty: hard
frequency: 4
core: false
tags: [context, performance, re-render, use-memo, use-reducer, react-compiler]
related:
  - react/context-and-composition/context-propagation
  - react/rendering-model/when-components-rerender
  - react/state/use-reducer
  - react/state/structuring-state
  - react/context-and-composition/custom-hooks
  - react/performance/memoization
  - react/performance/react-compiler
  - javascript/coercion-and-equality/equality-algorithms
verified: 2026-10
sources:
  - https://react.dev/reference/react/useContext#caveats
  - https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions
  - https://react.dev/reference/react/memo#updating-a-memoized-component-using-a-context
  - https://react.dev/reference/react/useReducer#dispatch
  - https://react.dev/learn/scaling-up-with-reducer-and-context#step-1-create-the-context
  - https://react.dev/learn/scaling-up-with-reducer-and-context#moving-all-wiring-into-a-single-file
  - https://react.dev/learn/react-compiler/introduction#what-kind-of-memoization-does-react-compiler-add
  - https://react.dev/reference/react/useSyncExternalStore#usesyncexternalstore
tldr: >
  Readers re-render whenever the provider's value changes by `Object.is`. So keep the value stable:
  memoize objects with `useMemo`/`useCallback` instead of building them inline. Split contexts by
  what changes together, typically state and `dispatch`. Put the state in a provider component that
  takes `children`. `memo` doesn't block context; for fine-grained subscriptions, use an external
  store.
---

## Answer

Context re-renders have three causes, each with its own fix.

**1. A new value every render.** `<Auth value={{ user, setUser }}>` builds a new object each time the provider's component renders, even for unrelated state, so `Object.is` fails and every reader re-renders. Wrap the object in `useMemo` with the data as dependencies, and functions in `useCallback`. State setters and `dispatch` are already stable. A primitive value needs nothing.

**2. No selectors.** A reader subscribes to the whole value. A component that reads only `theme` from `{ theme, lang }` re-renders when `lang` changes. Split the context by what changes together. The standard split is a reducer's state in one context and its `dispatch` in another: components that only dispatch never re-render on state changes, because `dispatch` never changes.

**3. The provider re-rendering too much of the tree.** If the state lives in a big component that also renders the page, every update re-renders the page as well. Move the state into a small provider component that takes `children`: an update re-renders the provider and the readers, while the `children` elements, created by its parent, are skipped. Keep providers as low as the readers allow.

What doesn't help: `memo` on components between the provider and the readers. Readers get their own update and render anyway; `memo` only stops renders that come from a parent rendering.

The React Compiler memoizes values like the inline object automatically, but it can't split a coarse context. When many components each need a slice of data that changes often, an external store read through `useSyncExternalStore`, typically via a state library with selectors, lets each component re-render only when its own slice changes.

Measure first: React's docs note that re-rendering readers is not a problem in smaller apps.

## Example

```jsx
const Auth = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState('ada');
  const [tick, setTick] = useState(0);
  const value = useMemo(() => ({ user, setUser }), [user]);
  return (
    <Auth value={value}>
      <button onClick={() => setTick(tick + 1)}>tick</button>
      <button onClick={() => setUser('bob')}>bob</button>
      {children}
    </Auth>
  );
}

function Greeting() {
  const { user } = useContext(Auth);
  console.log('Greeting', user);
  return <p>{user}</p>;
}

createRoot(document.getElementById('root')).render(<AuthProvider><Greeting /></AuthProvider>);
// Mount → Greeting ada
// Click "tick" → (no logs)
// Click "bob" → Greeting bob
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, clicks sent with `element.click()`. With `value={{ user, setUser }}` instead, "tick" logs `Greeting ada`: same user, new object. `Greeting` is skipped by the provider's render only because it's a `children` element; the context is what reaches it.

## Pitfalls

- Memoizing the value with a dependency that is itself rebuilt every render, such as an `options` object literal. The memo recomputes every time and fixes nothing.
- Splitting state and `dispatch`, then reading both in one `useTodos()` hook used everywhere. A component subscribes to every context it reads, so the split is lost.
- Wrapping readers or their parents in `memo` to stop context renders. It has no effect on a reader of a changed context.
- Putting a value that changes on every keystroke or pointer move into a context read across the app. Keep it local, or use a store with selectors.

## Follow-ups

**Q:** Does the React Compiler fix the inline value object?
**A:** In a run with `babel-plugin-react-compiler` 1.0.0, it cached `{ user, setUser }` keyed on `user`, and readers stopped re-rendering on "tick". It doesn't make a reader of `theme` ignore `lang` changes: that reader still re-rendered.

**Q:** Why doesn't the `dispatch` context need `useMemo`?
**A:** `dispatch` from `useReducer` has a stable identity, documented in its reference. The provider passes the same function every render, so `Object.is` always matches and that context never notifies its readers.

**Q:** Is a reducer plus context a replacement for a state library?
**A:** For app-level state read in a few places, often yes; React's docs scale it with many context-reducer pairs. It still re-renders every reader of a context on each change, which is where libraries with selectors differ.

## Deep dive

### How it works

React stores what each reader saw as the whole context value, and compares the provider's new value with the old one by `Object.is`. It has no record of which fields a component used, so it can't skip a reader that destructured an unchanged field. Every fix above works by changing either *when the value changes* (memoize it) or *which components read it* (split it).

### Real-world scenario

A todo screen keeps its list in `useReducer`. With one context holding `useMemo(() => ({ todos, dispatch }), [todos])`, adding a todo re-renders the add button too. Splitting it:

```jsx
const Todos = createContext(null);
const TodosDispatch = createContext(null);

function TodosProvider({ children }) {
  const [todos, dispatch] = useReducer(reducer, []);
  return (
    <Todos value={todos}>
      <TodosDispatch value={dispatch}>{children}</TodosDispatch>
    </Todos>
  );
}

function AddTodo() {
  const dispatch = useContext(TodosDispatch);
  console.log('AddTodo');
  return <button onClick={() => dispatch({ text: 'milk' })}>add</button>;
}

function Count() {
  const todos = useContext(Todos);
  console.log('Count', todos.length);
  return <p>{todos.length}</p>;
}
// <TodosProvider><AddTodo /><Count /></TodosProvider>
// Click "add" → Count 1    (one context: AddTodo, Count 1)
```

Same logs in Chrome 156 and Firefox 159, development and production builds, no Strict Mode.

### Trade-offs

- **`useMemo` on the value** is a one-line fix for identity, but every field still notifies every reader.
- **Splitting contexts** gives the closest thing to selectors that React has, at the cost of more providers and hooks to wire.
- **Moving state down or composing with `children`** reduces what re-renders around the provider, not who reads it.
- **An external store** gives per-slice subscriptions, but its state lives outside React's state model, and server rendering needs a server snapshot.
