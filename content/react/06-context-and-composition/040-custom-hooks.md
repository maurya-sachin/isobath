---
title: "What do custom hooks share between components, and what don't they?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [custom-hooks, hooks, state, naming, rules-of-hooks, react-compiler]
related:
  - react/rendering-model/rules-of-hooks
  - react/context-and-composition/composition-patterns
  - react/context-and-composition/context-propagation
  - react/state/structuring-state
  - react/effects/effect-events
  - react/effects/effect-dependencies
  - react/performance/memoization
  - react/performance/react-compiler
  - javascript/closures/what-is-a-closure
verified: 2026-10
perishable:
  - React Compiler 1.0.0 caching a non-use function call that calls hooks
sources:
  - https://react.dev/learn/reusing-logic-with-custom-hooks#extracting-your-own-custom-hook-from-a-component
  - https://react.dev/learn/reusing-logic-with-custom-hooks#hook-names-always-start-with-use
  - https://react.dev/learn/reusing-logic-with-custom-hooks#should-all-functions-called-during-rendering-start-with-the-use-prefix
  - https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-let-you-share-stateful-logic-not-state-itself
  - https://react.dev/learn/reusing-logic-with-custom-hooks#passing-reactive-values-between-hooks
  - https://react.dev/learn/reusing-logic-with-custom-hooks#passing-event-handlers-to-custom-hooks
  - https://react.dev/learn/reusing-logic-with-custom-hooks#keep-your-custom-hooks-focused-on-concrete-high-level-use-cases
  - https://react.dev/learn/reusing-logic-with-custom-hooks#custom-hooks-help-you-migrate-to-better-patterns
  - https://react.dev/reference/rules/rules-of-hooks#only-call-hooks-at-the-top-level
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/static-components
  - https://react.dev/reference/react-compiler/compilationMode#options
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  A custom hook shares stateful logic, not state. Its body runs inside each caller's render, so its
  `useState` and `useEffect` calls become that component's own hooks: two components calling
  `useCounter` get independent counts. Callers share data only through something outside them, like
  context or a store. The `use` prefix is how lint and the compiler find hooks.
---

## Answer

A custom hook is a function whose name starts with `use` and that calls other hooks. It's how React shares **logic** between components: an online-status subscription, a form field's state and handler, a data-fetching effect.

It doesn't share **state**. The hook's body runs inside the render of whichever component calls it, so its `useState` and `useEffect` calls become that component's own hooks. Two components calling `useCounter()` get two separate counts; one component calling it twice gets two as well. Copying the hook's body into the component would behave identically. React's docs: "Each call to a Hook is completely independent from every other call to the same Hook."

Callers see the same data only when the hook reads something that lives outside them: a context (then it's the provider's state), an external store, the browser. Two components using `useOnlineStatus()` agree because both subscribe to the same browser events, but each holds its own state and its own subscription. To share state itself, lift it up or put it in context.

Because the body runs on every render, a custom hook is part of the component: it must be pure during render, it always receives the latest props and state, and the functions it returns are new each render unless memoized.

The name matters. The docs: "Hook names must start with `use` followed by a capital letter." Tools rely on it:

- The `rules-of-hooks` lint rule allows hook calls only in components and `use` functions, and checks that `use` functions are called unconditionally.
- The React Compiler, by default, compiles functions named like components or hooks.

A function that calls no hooks should not be named `use…`: it could then be called in a condition, and the name would mislead.

## Example

```jsx
function useCounter(label) {
  const [count, setCount] = useState(0);
  console.log(label, count);
  return { count, increment: () => setCount((c) => c + 1) };
}

function Likes() {
  const { count, increment } = useCounter('Likes');
  return <button onClick={increment}>likes {count}</button>;
}

function Stars() {
  const { count, increment } = useCounter('Stars');
  return <button onClick={increment}>stars {count}</button>;
}

createRoot(document.getElementById('root')).render(<><Likes /><Stars /></>);
// Mount → Likes 0, Stars 0
// Click "likes 0" → Likes 1
// Click "likes 1" → Likes 2
// Buttons now read "likes 2" and "stars 0"
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode, clicks sent with `element.click()`. Same function, two components, two independent `useState` slots.

## Pitfalls

- Expecting a custom hook to act as a shared store. Each caller gets its own state; sharing needs lifted state, context or an external store.
- Naming a hook `getSomething`. The linter reports a hook called in a function that's neither a component nor a hook, and conditional calls to it go unchecked.
- Declaring a component inside a hook and returning `<Inner />`. Each render creates a new component type, so its state resets; the `static-components` lint rule reports "Cannot create components during render".
- Writing "lifecycle" hooks like `useMount(fn)`. The docs warn they hide dependencies from the `exhaustive-deps` rule, which checks only direct `useEffect` calls.

## Follow-ups

**Q:** How do you write a hook whose callers do share a value?
**A:** Read it from somewhere shared: `function useTheme() { return useContext(ThemeContext); }` returns the provider's state to every caller. For data outside React, wrap `useSyncExternalStore`. The hook then shares access, while the state lives in one place.

**Q:** Can a custom hook return JSX?
**A:** Yes, an element is a value. Return elements of components defined at module level: `<Field />` kept its typed text across re-renders. A component defined inside the hook lost it on every re-render.

**Q:** A hook receives an `onMessage` callback and uses it in an effect. What goes wrong?
**A:** A new callback every render makes it a changing dependency, so the effect re-subscribes on each render. Wrap it in an Effect Event (`useEffectEvent`) inside the hook, as the custom-hooks docs show for `useChatRoom`.

## Deep dive

### How it works

React has no runtime concept of a custom hook. In React 19.3.1, each built-in hook call appends a node to a list on the *currently rendering component's* fiber (`memoizedState` in `ReactFiberHooks.js`), and the next render matches calls by position. A custom hook is just a function that makes some of those calls, so its state lands in the caller's list:

- `Likes` calls `useCounter` → `Likes`'s fiber gets one `useState` node.
- `Stars` calls it → a separate node on `Stars`'s fiber.
- A component calling it twice gets two nodes, in call order.

That's why the Rules of Hooks apply transitively: calling a custom hook conditionally shifts the positions of every hook inside it. And it's why every value in the hook is the current render's: its closures capture that render's props and state, exactly like code written directly in the component.

### Edge cases

What the `use` prefix buys, checked with `eslint-plugin-react-hooks` 7.1.1 (ESLint 10.13.0) and `babel-plugin-react-compiler` 1.0.0:

```jsx
function getCounter() {
  const [count, setCount] = useState(0);
  return [count, () => setCount(count + 1)];
}

function Counter() {
  const [count, increment] = getCounter();
  return <button onClick={increment}>{count}</button>;
}
```

- The linter reports: React Hook "useState" is called in function "getCounter" that is neither a React function component nor a custom React Hook function.
- The compiler compiled `Counter` without a diagnostic and treated `getCounter()` as an ordinary function: it cached the result on the first render and reused it. Clicking re-rendered `Counter`, but the button kept showing `0` (Chrome 156 and Firefox 159, development and production builds). Renamed `useCounter`, the call isn't cached and the count updates.
- A conditional `if (show) { useCounter(); }` is reported as "React Hook "useCounter" is called conditionally". Under the `get` name, nothing would be reported.
- The opposite mistake, `useSorted(items)` that calls no hooks, gets no lint error, but callers can no longer call it conditionally. The docs: "If your function doesn't call any Hooks, avoid the `use` prefix."

### Real-world scenario

The docs' `useOnlineStatus` starts as `useState` plus an effect that listens to `online` and `offline` events. It assumes the user starts online, and reading `navigator.onLine` instead wouldn't work during server rendering. Rewriting the hook's body with `useSyncExternalStore` fixes them without touching any component that calls it. Hiding effects behind hooks with a clear purpose (`useOnlineStatus`, `useChatRoom`, `useData(url)`) makes data flow explicit and lets the implementation change later.

### Trade-offs

Hooks replaced most HOCs and render props for sharing logic: no wrapper components, no prop-name collisions, and the data flow is visible at the call site. The costs are the Rules of Hooks, which apply to every caller, and over-abstraction. The docs advise against extracting a hook for a single `useState`, and against generic wrappers that don't constrain what the caller can do. Name the hook after the use case; if no clear name comes, it isn't ready to be extracted.

## Exercises

### What logs?

```jsx
function Score() {
  const home = useCounter('home');
  const away = useCounter('away');
  return (
    <>
      <p>{home.count}:{away.count}</p>
      <button onClick={home.increment}>goal</button>
    </>
  );
}
// useCounter from the Example. Mount, then click "goal" twice.
```

**Answer:** `home 0`, `away 0`, then `home 1`, `away 0`, then `home 2`, `away 0`, without Strict Mode. Two calls in one component are two independent states. Updating `home` re-renders `Score`, which runs both hook calls again; `away` is unchanged.
