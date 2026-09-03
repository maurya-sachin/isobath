---
title: "What does the React Compiler do, and what does it require of your code?"
status: draft
difficulty: medium
frequency: 4
core: true
tags: [react-compiler, memoization, rules-of-react, purity, eslint, build-tools]
related:
  - react/performance/memoization
  - react/performance/profiling
  - react/rendering-model/when-components-rerender
  - react/rendering-model/purity-and-strict-mode
  - react/rendering-model/rules-of-hooks
  - react/state/immutable-updates
  - react/refs/refs-vs-state
  - react/effects/effect-dependencies
  - react/context-and-composition/context-performance
  - react/context-and-composition/custom-hooks
verified: 2026-10
perishable:
  - babel-plugin-react-compiler 1.0.0 output shape and diagnostics
  - Which Rules of React violations compiler and lint detect
sources:
  - https://react.dev/learn/react-compiler/introduction#what-kind-of-memoization-does-react-compiler-add
  - https://react.dev/learn/react-compiler/introduction#expensive-calculations-also-get-memoized
  - https://react.dev/learn/react-compiler/introduction#what-should-i-do-about-usememo-usecallback-and-reactmemo
  - https://react.dev/learn/react-compiler/installation#basic-setup
  - https://react.dev/learn/react-compiler/installation#eslint-integration
  - https://react.dev/learn/react-compiler/installation#check-react-devtools
  - https://react.dev/learn/react-compiler/debugging#common-breaking-patterns
  - https://react.dev/reference/react-compiler/compilationMode#options
  - https://react.dev/reference/react-compiler/directives#available-directives
  - https://react.dev/reference/react-compiler/panicThreshold#options
  - https://react.dev/reference/react-compiler/logger#event-types
  - https://react.dev/reference/react-compiler/target#valid-values
  - https://react.dev/reference/react/memo#react-compiler-memo
  - https://react.dev/reference/rules#components-and-hooks-must-be-pure
  - https://react.dev/reference/eslint-plugin-react-hooks#recommended
  - https://react.dev/blog/2025/10/07/react-compiler-1#how-does-react-compiler-work
  - https://react.dev/blog/2025/10/07/react-compiler-1#migrating-from-eslint-plugin-react-compiler-to-eslint-plugin-react-hooks
  - https://react.dev/blog/2025/10/07/react-compiler-1#upgrading-react-compiler
  - https://github.com/facebook/react/tree/v19.3.1/compiler/packages/babel-plugin-react-compiler
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  A build-time Babel plugin that memoizes components and hooks for you: it caches values, functions
  and JSX keyed on their inputs, so unchanged children get the same element and React skips them. It
  assumes the Rules of React. A function it can prove breaks them is skipped, silently by default;
  a violation it can't detect is compiled and may misbehave.
---

## Answer

The React Compiler (`babel-plugin-react-compiler`, stable since 1.0 in October 2025) runs at build time. It analyzes each component and hook, works out which values depend on which props, state and context, and rewrites the function so each value, callback and JSX element is cached and recomputed only when its inputs change.

The effect is `useMemo` and `useCallback` around everything, plus the job of `memo`: when a parent re-renders, an unchanged child gets back the same element object, and React skips it. It can memoize where hooks can't, such as after an early return. It targets updates, not the first render.

Caching is only safe for code that gives the same result anyway, so it requires the Rules of React:

- **Pure render.** No side effects, no `Date.now()` or `Math.random()`, no reading or writing `ref.current`, no reassigning variables outside the component.
- **Immutability.** Props, state, hook arguments and values passed to JSX are never mutated.
- **Rules of Hooks and naming.** By default it compiles only functions named like components (PascalCase, returning JSX or calling hooks) or hooks (`use…`, calling hooks).

When it detects a violation, it bails out of that one function and leaves it as written; the rest of the file is still compiled. By default the bail-out is silent: the build passes and prints nothing. The same analysis ships as lint rules in `eslint-plugin-react-hooks` 7 (`refs`, `purity`, `globals`, `set-state-in-render` and more), which is where you see the problems. A violation it can't detect is compiled, and behaviour can change.

Escape hatches: `"use no memo"` opts one function out; `compilationMode: 'annotation'` compiles only functions marked `"use memo"`. `useMemo` and `useCallback` stay for precise control, such as keeping an effect dependency stable.

## Example

```jsx
// Source
function TodoList({ todos, onToggle }) {
  const done = todos.filter(isDone);
  return <List items={done} onToggle={onToggle} />;
}
// babel-plugin-react-compiler 1.0.0 output
import { c as _c } from "react/compiler-runtime";
function TodoList(t0) {
  const $ = _c(5);
  const { todos, onToggle } = t0;
  let t1;
  if ($[0] !== todos) {
    t1 = todos.filter(isDone);
    $[0] = todos;
    $[1] = t1;
  } else {
    t1 = $[1];
  }
  const done = t1;
  let t2;
  if ($[2] !== done || $[3] !== onToggle) {
    t2 = <List items={done} onToggle={onToggle} />;
    $[2] = done;
    $[3] = onToggle;
    $[4] = t2;
  } else {
    t2 = $[4];
  }
  return t2;
}
```

The destructuring is joined onto one line; the rest is verbatim. Mounted under a parent that then re-rendered twice with the same `todos` and `onToggle`, `TodoList` ran each time and returned the cached element, and `List` rendered only once (Chrome 156 and Firefox 159, development and production builds of React 19.3.1).

## Pitfalls

- Reading "compiled without errors" as "correct". The compiler skips only what it detects; `Date.now()` in JSX was compiled and frozen.
- Code that relies on memoization for correctness, such as an effect that must not re-run. The docs list it as the main way the compiler breaks apps, and a compiler upgrade can change what is memoized: pin an exact version.
- Deleting existing `useMemo` and `useCallback` on adoption. The docs advise leaving them or testing carefully, since removing them can change the output.
- Expecting it to optimize helpers outside components and hooks, share results between components, or split a coarse context. It does none of these.

## Follow-ups

**Q:** Does the compiler make `memo`, `useMemo` and `useCallback` unnecessary?
**A:** Mostly. The `memo` page: "When you enable React Compiler, you typically don't need React.memo anymore." For new code the docs recommend "relying on the compiler for memoization and using useMemo/useCallback where needed to achieve precise control"; existing memoization can stay.

**Q:** How do you check that a component was compiled?
**A:** Its build output calls `_c(n)` and has cache checks. The docs say compiled components show a "Memo ✨" badge in React DevTools (not checked here). A `logger` reports a `CompileSuccess` or `CompileError` event per function.

**Q:** Can you use it with React 17 or 18?
**A:** Yes. Set `target: '18'` (or `'17'`) and add `react-compiler-runtime` as a runtime dependency. With that target the output imported `c` from `react-compiler-runtime` instead of React 19's built-in `react/compiler-runtime`.

**Q:** What does `panicThreshold` change?
**A:** What a detected violation does. The default `'none'` skips the function and continues. `'critical_errors'` and `'all_errors'` fail the build; both failed on a component reading `ref.current`. The docs say production builds should always use `'none'`.

## Deep dive

### How it works

The plugin must run first in the Babel pipeline. It lowers each function to its own intermediate representation, tracks data flow and mutation, and groups the code that produces each value into a scope with a list of reactive inputs. Each scope becomes one `if` block that recomputes when any input differs by `!==` and otherwise reads the cache. Values with no reactive inputs are checked against a sentinel, so they are created once; functions that capture nothing are hoisted out of the component as `_temp`.

`_c(n)` is React 19's `useMemoCache(n)` (`ReactFiberHooks.js` in 19.3.1, an implementation detail): an array of `n` slots kept on the component's fiber and filled with `Symbol.for("react.memo_cache_sentinel")` on mount. No `memo` wrapper is added. A child is skipped because its parent returns the same element object, the same bailout `children` gets.

Existing `useMemo` calls are compiled into ordinary cache slots, after checking that the dependencies the compiler infers match the ones written. Which functions are compiled is set by `compilationMode`. Run on one file:

| Function | `'infer'` (default) | `'annotation'` | `'all'` |
|---|---|---|---|
| `Plain` component | compiled | not compiled | compiled |
| `renderRow`, lowercase, returns JSX | not compiled | not compiled | compiled |
| `total()` with `"use memo"` | compiled | compiled | compiled |
| component with `"use no memo"` | not compiled | not compiled | not compiled |

### Edge cases

What babel-plugin-react-compiler 1.0.0 and eslint-plugin-react-hooks 7.1.1 (recommended preset, ESLint 10.13.0) did with each violation:

| In render | Compiler | Lint rule |
|---|---|---|
| `ref.current++` | skipped: "Cannot access refs during render" | `refs` |
| `renders = renders + 1` on a module variable | skipped | `globals` |
| `setN(n + 1)` | skipped | `set-state-in-render` |
| `useState` inside `if` | skipped | `rules-of-hooks` |
| `useMemo(() => [...items].sort(by), [items])` | skipped: "Existing memoization could not be preserved" | `exhaustive-deps` (warning) |
| `<p>{Date.now()}</p>` | **compiled** | `purity` |
| `items.push('x')` on a prop or state | **compiled** | none |

The installation guide says a lint error means the compiler will skip that component. The `Date.now()` row disagrees: the compiler cached `<p>{Date.now()}</p>` behind a sentinel check, so the timestamp never changed on re-render, while uncompiled it did (both browsers, both builds). The lint rule is the earlier warning; rely on it rather than the build.

The default `panicThreshold: 'none'` printed nothing for the skipped functions. Seeing them takes a `logger`, which received `CompileError` events with a `reason`, a category and a location, and `CompileSkip` for `"use no memo"`.

### Real-world scenario

Adopting it in an existing app:

1. Install `eslint-plugin-react-hooks` 7 first; the 1.0 post notes it doesn't need the compiler. Fix what `refs`, `purity`, `immutability` and `set-state-in-render` report.
2. Enable the compiler, in stages if the codebase is large: `compilationMode: 'annotation'` plus `"use memo"` on chosen components, or `"use no memo"` on known-bad ones.
3. When a compiled component misbehaves, add `"use no memo"`. If the bug disappears, look for a Rules of React violation, often code that relied on memoization; then remove the directive.
4. Keep existing `useMemo` and `useCallback`. If test coverage is thin, pin the compiler to an exact version, as the 1.0 post recommends: upgrades can change memoization.

### Trade-offs

You get memoization that is consistent and finer-grained than people write by hand, without dependency arrays. You pay with a Babel step in the build, larger output, a cache per component, and compiled code that's harder to step through. Its cache isn't shared across components, and helpers outside components and hooks aren't compiled, so a truly expensive pure function may still need its own memoization. Above all it makes the Rules of React load-bearing: breaking them used to cost an extra render, and now it can freeze a value.

## Exercises

### What does the compiler cache?

```jsx
function useTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

function CartSummary({ items }) {
  const total = useTotal(items);
  return <p>{total}</p>;
}
// The parent re-renders with the same items array. Does the reduce run again?
```

**Answer:** Yes, on every render. `useTotal` calls no hooks, so in `'infer'` mode it isn't compiled; and inside `CartSummary` the compiler didn't cache the hook call, so only `<p>` is cached, keyed on `total`. Renamed `getTotal`, the call was cached on `items` and the reduce ran once across the mount and two re-renders (Chrome 156 and Firefox 159, both builds).
