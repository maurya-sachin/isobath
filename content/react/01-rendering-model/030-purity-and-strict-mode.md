---
title: "Why must rendering be pure, and how does Strict Mode catch impure components?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [purity, strict-mode, idempotence, side-effects, double-rendering]
related:
  - react/rendering-model/render-and-commit
  - react/state/immutable-updates
  - react/effects/effect-cleanup
  - react/refs/ref-callbacks-and-ref-prop
  - react/performance/react-compiler
  - react/concurrent-rendering/interruptible-rendering
verified: 2026-10
perishable:
  - "React 19.3.1 logs both Strict Mode calls; DevTools dims the second"
  - "useId format in React 19.3.1: _r_0_"
sources:
  - https://react.dev/learn/keeping-components-pure#side-effects-unintended-consequences
  - https://react.dev/learn/keeping-components-pure#local-mutation-your-components-little-secret
  - https://react.dev/learn/keeping-components-pure#why-does-react-care-about-purity
  - https://react.dev/reference/rules/components-and-hooks-must-be-pure#components-and-hooks-must-be-idempotent
  - https://react.dev/reference/rules/components-and-hooks-must-be-pure#side-effects-must-run-outside-of-render
  - https://react.dev/reference/react/StrictMode#strictmode
  - https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-double-rendering-in-development
  - https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-ref-callbacks-in-development
  - https://react.dev/reference/react/useState#my-initializer-or-updater-function-runs-twice
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#strict-mode-improvements
  - https://react.dev/blog/2022/03/08/react-18-upgrade-guide#other-notable-changes
tldr: >
  React may call a component any number of times or discard the result, so rendering must be
  idempotent: same props, state and context, same output, and no changes to anything that existed
  before the call. In development, Strict Mode calls each component body and the functions passed
  to `useState`, `useReducer` and `useMemo` twice, so impurity becomes visible.
---

## Answer

Rendering is React calling your component to find out what the UI should look like. React treats that call as a pure calculation: given the same props, state and context it must return the same elements, and it must not change anything that existed before the call: module variables, props, state objects, the DOM, a network request.

**Why React needs it.** React doesn't promise one call per update. It may render a component and throw the result away (an interrupted transition, a Suspense retry), render it twice (Strict Mode), skip it because its inputs didn't change (`memo`, the React Compiler), or render it on the server. Each of those is only safe if calling the component has no effect beyond its return value.

**What's allowed.** Local mutation is fine: building a new array and pushing into it during render changes nothing anyone else can see. Lazy initialisation (a `useState` initializer) is fine. Side effects go in event handlers, or in effects as a last resort; they run outside rendering.

**How Strict Mode catches violations.** Inside `<StrictMode>`, development builds call these functions twice:

- the component body (not event handlers);
- functions passed to `useState`, `useReducer` and `useMemo`, and the reducer and updater functions;
- some class methods, such as `constructor`, `render` and `shouldComponentUpdate`.

A pure function returns the same thing twice, so nothing changes. An impure one shows the difference: an item pushed twice, a counter that skips numbers. React keeps one result and ignores the other.

Strict Mode also runs an extra effect setup and cleanup cycle, and an extra ref callback setup and cleanup on mount; those test cleanup, not purity. None of it happens in production builds.

Double rendering only catches impurity that changes the result between two back-to-back calls.

## Example

```jsx
let nextId = 0;

function Field({ label }) {
  const id = `field-${nextId++}`; // impure: changes a variable outside the component
  return <label htmlFor={id}>{label}</label>;
}

function PureField({ label }) {
  const id = useId(); // pure: derived from the component's position in the tree
  return <label htmlFor={id}>{label}</label>;
}

const container = document.getElementById('root');
const root = createRoot(container);
const render = () => flushSync(() => root.render(
  <StrictMode>
    <Field label="Name" />
    <Field label="Email" />
    <PureField label="Phone" />
  </StrictMode>,
));
const ids = () => [...container.querySelectorAll('label')].map((label) => label.htmlFor).join(', ');

render();
console.log(ids()); // → field-1, field-3, _r_0_
render();
console.log(ids()); // → field-5, field-7, _r_0_
```

Development build of React 19.3.1 in Chrome 156 and Firefox 159. The production build prints `field-0, field-1, _r_0_`, then `field-2, field-3, _r_0_`: the ids drift on every render anyway, and a server render would produce different ones than the client. Strict Mode just makes the bug visible on the first render. `useId` gives the same id each time.

## Pitfalls

- Removing `<StrictMode>`, or adding a "has run" flag, to stop double logs. That hides the bug; production can still call the component more than once.
- Mutating props or state during render, such as `items.push(extra)` on an array from props. Copy first, or compute a new array.
- Reading values that change between calls (`Math.random()`, `new Date()`) in render. Move them into an effect, a handler or a lazy initializer.
- Treating Strict Mode as proof of purity. An in-place `sort()` of a props array returns the same order twice, so it passes, yet still mutates the parent's data.

## Follow-ups

**Q:** Does `console.log` in a component print twice in Strict Mode?
**A:** Yes, in React 19.3.1 both calls printed in Chrome and Firefox. With React DevTools installed the second log is dimmed, and a DevTools setting can hide it. *Legacy:* React 17 suppressed console logs during the second call.

**Q:** Does Strict Mode run the `useMemo` calculation four times on mount?
**A:** No. In React 19.3.1 the `useState` initializer and the `useMemo` calculation each ran twice during the first body call, and the second body call reused their results, as the React 19 upgrade guide describes. Each still ran twice, not four times.

**Q:** Are event handlers double-invoked?
**A:** No. They don't run during rendering, so they don't need to be pure; that's where side effects belong. Only the component body and the functions React calls while rendering are doubled.

## Exercises

### Count the calls

```jsx
const root = createRoot(document.getElementById('root'));
const rendered = [];
function Item({ name }) {
  rendered.push(name);
  return <li>{name}</li>;
}

flushSync(() => root.render(<StrictMode><ul><Item name="a" /><Item name="b" /></ul></StrictMode>));
console.log(rendered.join(' '));
```

**Answer:** `a a b b` in a development build: Strict Mode calls each component body twice in a row before moving on to the next component. A production build prints `a b`.
