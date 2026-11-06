---
title: "When does a React component re-render?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [re-render, state, context, children, bailout, object-is]
related:
  - react/rendering-model/render-and-commit
  - react/rendering-model/jsx-and-elements
  - react/state/state-as-snapshot
  - react/state/immutable-updates
  - react/context-and-composition/context-propagation
  - react/context-and-composition/composition-patterns
  - react/performance/memoization
  - react/performance/react-compiler
  - react/reconciliation/preserving-and-resetting-state
  - javascript/coercion-and-equality/equality-algorithms
verified: 2026-10
sources:
  - https://react.dev/learn/render-and-commit#step-1-trigger-a-render
  - https://react.dev/learn/render-and-commit#step-2-react-renders-your-components
  - https://react.dev/learn/render-and-commit#optimizing-performance
  - https://react.dev/reference/react/useState#setstate-caveats
  - https://react.dev/reference/react/useState#ive-updated-the-state-but-the-screen-doesnt-update
  - https://react.dev/reference/react/useContext#caveats
  - https://react.dev/reference/react/useContext#optimizing-re-renders-when-passing-objects-and-functions
  - https://react.dev/reference/react/memo#minimizing-props-changes
  - https://react.dev/learn/react-compiler/introduction#optimizing-re-renders
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberBeginWork.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  A component re-renders when its own state changes, when its parent re-renders, or when a
  context it reads gets a new value. Props changing isn't a trigger: props can only change
  because the parent rendered, and a parent render re-renders children with identical props too.
  Elements the parent didn't create, such as `children`, are skipped.
---

## Answer

After the first render, a component renders again for one of three reasons:

1. **Its own state changed.** A `useState` setter or `useReducer` dispatch with a new value. The new value is compared with `Object.is`; if it's the same, React skips the component and its children (it may still call the component once before bailing out).
2. **Its parent re-rendered.** Rendering is recursive: when a component renders, every component in the JSX it returns renders too, whether or not their props changed. Each `<Footer text="© 2026" />` call creates a new props object, and by default React doesn't compare props.
3. **A context it reads changed.** When a provider's `value` changes (by `Object.is`), every component that reads that context with `useContext` or `use` re-renders, even if everything between them skipped rendering.

External stores read through `useSyncExternalStore` are the same mechanism as state: a store change schedules an update for the subscribed component.

"It re-renders because its props changed" gets the cause backwards. Props come from the parent's render, so they can only change when the parent renders, and that render alone is enough. Mutating an object that was passed as a prop triggers nothing.

The flip side is the key to cheap renders: React skips a component whose element is *the same object* as last time. Elements a component receives as `children` (or any prop) were created by *its* parent. If only the component's own state changed, those elements are unchanged and React doesn't call them. Moving state down, or passing parts of the tree in as `children`, limits re-renders without `memo`.

To skip rendering when props are shallowly equal, wrap the child in `memo`; the React Compiler does the equivalent automatically. A changed `key` is different: React unmounts and mounts a new instance rather than re-rendering.

## Example

```jsx
const Theme = createContext('light');

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');
  console.log('ThemeProvider');
  return (
    <Theme value={theme}>
      <button onClick={() => setTheme('dark')}>dark</button>
      <Footer text="© 2026" />
      {children}
    </Theme>
  );
}

function Footer({ text }) { console.log('Footer'); return <p>{text}</p>; }
function Sidebar() { console.log('Sidebar'); return <ThemedLabel />; }
function ThemedLabel() { const theme = useContext(Theme); console.log('ThemedLabel', theme); return <p>{theme}</p>; }

function App() {
  console.log('App');
  return <ThemeProvider><Sidebar /></ThemeProvider>;
}
// Mount → App, ThemeProvider, Footer, Sidebar, ThemedLabel light
// Click "dark" → ThemeProvider, Footer, ThemedLabel dark
// Click "dark" again → ThemeProvider
// Click "dark" a third time → (no logs)
```

Same logs in Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode. `Footer` re-rendered with identical props because its parent rendered. `Sidebar` didn't: `App` created that element and didn't re-render. `ThemedLabel` re-rendered through context alone. The second same-value click still called `ThemeProvider` once, then bailed out.

## Pitfalls

- Expecting `memo`'d children to skip renders while passing them a fresh object, array or arrow function each render. `Object.is` sees a new reference every time.
- Mutating state and setting the same reference: `todos.push(x); setTodos(todos)`. `Object.is` says nothing changed, so nothing renders.
- Lifting state to the top of the tree "just in case". Every update then re-renders everything below it.
- Counting renders in Strict Mode. Development builds call each component twice per render there; count in production or outside `<StrictMode>`.

## Follow-ups

**Q:** Does a component re-render if it only *passes* a context's provider down?
**A:** No. Only components that read the context re-render because of it. In the example, `Sidebar` sits between the provider and `ThemedLabel` and was skipped.

**Q:** Why did the second "dark" click call `ThemeProvider` at all?
**A:** In React 19.3.1, `setState` compares eagerly only when neither copy of the component's fiber has pending work. Right after the first update one still did, so React rendered `ThemeProvider`, found the state unchanged, and skipped its children. By the third click the eager comparison applied and nothing was scheduled.

**Q:** Does a re-render mean the DOM changed?
**A:** No. Re-rendering means React called the component. The commit then applies only the differences, often none.

## Deep dive

### How it works

React 19.3.1 decides per fiber, walking down from the root (implementation details from `ReactFiberBeginWork.js` and `ReactFiberHooks.js`):

- **Pending update.** A state update marks a lane on the component's fiber and a `childLanes` marker on every ancestor, so React knows which subtrees contain work.
- **Props check.** For each fiber it compares `oldProps !== newProps`, by reference. A parent that rendered created new elements with new props objects, so the check always fails and the child renders. A fiber whose element wasn't recreated keeps the same props object.
- **Bailout.** With the same props, no pending update and no changed context, React doesn't call the component. If no descendant has pending work (`childLanes`), it skips the entire subtree; otherwise it reuses this fiber and keeps walking to the descendants that do.
- **Context.** When a provider's value changes, React finds the fibers that depend on that context and marks updates on them, so they render even inside a bailed-out subtree.

### Edge cases

- **Same-value updates.** `dispatchSetState` computes the next state immediately when the fiber's queue is empty; if `Object.is` says it's unchanged, it drops the update without scheduling a render. When the queue isn't empty, React must render the component to find out, then bails out on its children. That's the documented "may still need to call your component".
- **Updater functions** that return the previous state bail out the same way: `setTodos((t) => t)` logged nothing on two clicks.
- **Context values built during render.** `<Theme value={{ theme, toggle }}>` creates a new object every time the provider renders, so every consumer re-renders even if `theme` didn't change. Memoize the value or split the context.
- **Strict Mode** doubles each render in development, but it doesn't add re-renders: the trigger rules are the same.

### Real-world scenario

A search page keeps `query` in its top-level component. Every keystroke re-renders the header, the results and the footer, because they're all returned by the component that owns the state. Moving `query` into a `<SearchBox>` component, or making the layout take the slow parts as `children`, means a keystroke renders only `SearchBox`. Reach for `memo` when the structure can't change.

### Trade-offs

Re-rendering children by default is simple and correct: React never has to know whether a child depends on something the parent didn't pass as a prop. The cost is CPU time for components whose output didn't change. React leaves the optimisation to you (`memo`, `useMemo`, composition) or to the React Compiler, which memoizes components and JSX automatically when code follows the Rules of React.

## Exercises

### Why doesn't it update?

```jsx
function TodoList() {
  const [todos, setTodos] = useState(['milk']);
  console.log('render', todos.length);
  function add() {
    todos.push('eggs');
    setTodos(todos);
  }
  return <button onClick={add}>add</button>;
}
```

**Answer:** It logs `render 1` on mount and nothing on any click. `todos` is the same array object, so `Object.is(todos, todos)` is `true` and React drops the update. Use `setTodos([...todos, 'eggs'])`.
