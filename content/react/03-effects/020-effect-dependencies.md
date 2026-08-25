---
title: "How do effect dependencies work, and how do you fix a stale closure?"
status: draft
difficulty: hard
frequency: 5
core: true
tags: [use-effect, dependencies, stale-closure, object-is, exhaustive-deps, eslint]
related:
  - javascript/closures/what-is-a-closure
  - javascript/coercion-and-equality/equality-algorithms
  - react/state/state-as-snapshot
  - react/state/batching-and-updater-functions
  - react/effects/effect-timing
  - react/effects/effect-cleanup
  - react/effects/effect-events
  - react/effects/you-might-not-need-an-effect
  - react/refs/refs-vs-state
  - react/performance/memoization
verified: 2026-10
perishable:
  - "eslint-plugin-react-hooks 7.1.1 rule names and messages"
sources:
  - https://react.dev/reference/react/useEffect#parameters
  - https://react.dev/reference/react/useEffect#updating-state-based-on-previous-state-from-an-effect
  - https://react.dev/reference/react/useEffect#removing-unnecessary-object-dependencies
  - https://react.dev/reference/react/useEffect#removing-unnecessary-function-dependencies
  - https://react.dev/learn/synchronizing-with-effects#why-was-the-ref-omitted-from-the-dependency-array
  - https://react.dev/learn/lifecycle-of-reactive-effects#all-variables-declared-in-the-component-body-are-reactive
  - https://react.dev/learn/lifecycle-of-reactive-effects#can-global-or-mutable-values-be-dependencies
  - https://react.dev/learn/removing-effect-dependencies#dependencies-should-match-the-code
  - https://react.dev/learn/removing-effect-dependencies#why-is-suppressing-the-dependency-linter-so-dangerous
  - https://react.dev/learn/removing-effect-dependencies#move-dynamic-objects-and-functions-inside-your-effect
  - https://react.dev/reference/eslint-plugin-react-hooks#recommended
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  Each render creates an effect closing over that render's props and state. React compares each
  dependency with the last render's using `Object.is` and runs the new effect only if one changed.
  Omit a value and the old effect keeps its old value: a stale closure. Fix the code, not the
  array: list it, use an updater, move objects inside.
---

## Answer

The dependency array lists every **reactive value** the effect reads: props, state, and anything declared in the component body, functions included. It isn't a "when to run" switch; it describes the code.

- **No array**: the effect runs after every commit.
- **`[]`**: it reads nothing reactive, so it runs after mount only.
- **`[a, b]`**: React compares each item with the previous render's using `Object.is` and re-runs the effect if any differs. Objects and functions created during render are new every time, so they always differ.

**Stale closures.** Every render calls your component again, creating a new effect function that closes over *that* render's values. When dependencies are unchanged, React doesn't run the new effect; whatever the old one set up keeps running with the values it saw. Omit `count` from an interval effect and the interval keeps reading `count` from the first render forever.

The `react-hooks/exhaustive-deps` lint rule catches this and suggests a fix. Don't silence it; change the code so it no longer needs the value:

1. **The effect should re-sync when the value changes**: list it. That's the usual answer.
2. **The value is only used to compute the next state**: use an updater, `setCount(c => c + 1)`. The effect no longer reads `count`.
3. **An object or function made during render**: create it inside the effect, depend on its primitive parts, or move static ones out of the component. `useMemo`/`useCallback` work but move the problem to their own dependencies.
4. **The effect needs the latest value without re-syncing on it** (a theme in a "connected" notification): read it in an Effect Event, `useEffectEvent`.

`useRef` objects and `useState` setters have stable identities, so they can be omitted; the linter knows that when it can see where they come from.

## Example

```jsx
function StaleTicker() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount(count + 1), 100); // reads count from the first render
    return () => clearInterval(id);
  }, []);
  return <p id="stale">{count}</p>;
}

function Ticker() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 100); // no longer reads count
    return () => clearInterval(id);
  }, []);
  return <p id="fresh">{count}</p>;
}

createRoot(document.getElementById('root')).render(<><StaleTicker /><Ticker /></>);
setTimeout(() => {
  console.log(document.getElementById('stale').textContent); // → 1
  console.log(document.getElementById('fresh').textContent); // → 5
}, 550);
```

Same result in 10 of 10 runs each in Chrome 156 and Firefox 159, development and production builds of React 19.3.1. The stale interval sets `0 + 1` every tick; after the first, React bails out because the state is already `1`.

## Pitfalls

- Suppressing the rule with `// eslint-disable-next-line`. The bug may not exist yet, but the next edit to the effect won't be checked.
- Adding an object or function created in render as a dependency. The effect re-runs every render, and loops forever if it also sets state.
- Using `[]` to mean "run once" while reading props: the effect never sees new ones. Run-once logic usually belongs outside the component or in an event.
- Expecting deep comparison. `{ id: 1 }` and `{ id: 1 }` differ under `Object.is`; `NaN` and `NaN` don't.

## Follow-ups

**Q:** Why can `ref` and `setCount` be left out?
**A:** React guarantees the same `useRef` object and the same setter on every render, so they never trigger a re-run. That's only known when they come from this component; a ref passed as a prop must be listed.

**Q:** Should `ref.current` be a dependency?
**A:** No. Mutating it doesn't re-render, so React never compares a new value. The linter warns: "Mutable values like 'ref.current' aren't valid dependencies because mutating them doesn't re-render the component."

**Q:** Does an updater work when the effect needs two state values?
**A:** Only for computing one state from its own previous value. When the next state depends on several values, move the logic into a reducer with `useReducer` and dispatch an action; `dispatch` is stable too.

## Deep dive

### How it works

In React 19.3.1 (implementation detail, `ReactFiberHooks.js`), a re-render calls `updateEffectImpl`. It compares the new array with the stored one in `areHookInputsEqual`, a loop of `Object.is` over the items. If all match, it stores the new effect object *without* the `HasEffect` flag, so the commit skips it: the cleanup and subscriptions from the last run stay in place. If any differs, it flags the fiber, and the commit runs the old cleanup and then the new setup. Without an array, `deps` is `null` and the comparison never happens. A development build logs "The final argument passed to useEffect changed size between renders" if the length changes.

So "stale" isn't a React cache: the interval callback in the Example is still the function created by the first render's effect, and JavaScript closures keep the bindings they were created with. React has a newer effect function each render; it just never runs it.

### Edge cases

Objects recreated in render defeat the comparison:

```jsx
function ChatRoom({ roomId }) {
  const options = { serverUrl: 'https://chat.example', roomId }; // new object each render
  useEffect(() => {
    console.log('connect', options.roomId);
    return () => console.log('disconnect', options.roomId);
  }, [options]);
  return null;
}
// Rendered three times with the same roomId:
// → connect general
// → disconnect general
// → connect general
// → disconnect general
// → connect general
```

Production build, Chrome 156 and Firefox 159. With the object created inside the effect and `[roomId]` as dependencies, it connected once. The linter says the same: "The 'options' object makes the dependencies of useEffect Hook (at line 6) change on every render. Move it inside the useEffect callback."

`Object.is` also means `NaN` → `NaN` doesn't re-run the effect, and `0` → `-0` does; both were confirmed in the test.

### Real-world scenario

A dashboard fetches with `useEffect(() => { load(filters) }, [filters])`, where the parent builds `filters` as an object literal. Every parent render refetches. Depend on the primitives instead, `[filters.status, filters.page]`, and build the request inside the effect; or have the parent memoize the object. Removing `filters` from the array would stop the refetching and also stop refetching when the filters really change.

### Trade-offs

Honest dependencies make an effect correct by construction: it re-syncs whenever anything it reads changes. The price is that reading a value means reacting to it. When that's wrong, restructure: updaters, moving code into the effect or into the event handler that caused it, or an Effect Event. In eslint-plugin-react-hooks 7.1.1, the `recommended` preset also enables compiler-based rules alongside `exhaustive-deps`, such as `react-hooks/set-state-in-effect`, which flags calling a setter synchronously in an effect body.
