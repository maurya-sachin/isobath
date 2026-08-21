---
title: "Why can't hooks be called conditionally?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [hooks, rules-of-hooks, use-state, eslint, fiber]
related:
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/context-and-composition/custom-hooks
  - react/suspense/use-api
  - react/reconciliation/preserving-and-resetting-state
  - react/concurrent-rendering/fiber
  - javascript/closures/what-is-a-closure
verified: 2026-10
perishable:
  - "eslint-plugin-react-hooks 7.1.1 is current"
sources:
  - https://react.dev/reference/rules/rules-of-hooks#only-call-hooks-at-the-top-level
  - https://react.dev/reference/rules/rules-of-hooks#only-call-hooks-from-react-functions
  - https://react.dev/learn/state-a-components-memory#how-does-react-know-which-state-to-return
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks#rule-details
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks#use-hook
  - https://react.dev/reference/react/use
  - https://react.dev/blog/2026/09/09/react-19-3#changelog
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  Hooks have no names or keys. React matches each call to its stored state purely by position:
  the first hook call in this render gets the first slot from the last render, and so on. A
  condition, loop or early return that changes the sequence hands a hook another hook's state,
  or makes React throw "Rendered more hooks…"
---

## Answer

`useState('Ada')` passes no identifier, so React can't know *which* state variable a call refers to by looking at it. It relies on order: React keeps a list of hook slots for each component instance, and during a render it hands out the slots one by one as hooks are called. The first `useState` gets slot 1, the next hook gets slot 2, every render.

That only works if every render calls the same hooks in the same order. So the Rules of Hooks:

- **Call hooks only at the top level** of a function component or custom hook: not inside conditions, loops, nested functions, `try`/`catch`/`finally`, or after an early `return`.
- **Call hooks only from React functions**: components and custom hooks (functions named `use…`), never from plain functions, class components, event handlers or effects.

If a condition skips a hook, every later hook shifts one slot. With the same number and types of hooks, that is silent: a variable shows another variable's state. With a different count, React throws "Rendered more hooks than during the previous render." or "Rendered fewer hooks than expected. This may be caused by an accidental early return statement." When the hook kinds at a position differ, development builds also log "React has detected a change in the order of Hooks".

The fix is structural: call the hook unconditionally and put the condition inside it (in the effect body, in the value you use), or move the conditional part into a child component that is rendered conditionally, so it gets its own slots.

The `react-hooks/rules-of-hooks` rule in `eslint-plugin-react-hooks` catches these at build time. `use` is the one exception: it can be called in conditions and loops.

## Example

```jsx
function Slots({ showFirst }) {
  let first, last;
  if (showFirst) [first] = useState('first'); // 🔴 conditional
  const [middle] = useState('middle');
  if (!showFirst) [last] = useState('last'); // 🔴 conditional
  return `${first} ${middle} ${last}`;
}

function Gate({ loading }) {
  const [count] = useState(0);
  if (loading) return 'Loading…';
  const [label] = useState('ready'); // 🔴 after an early return
  return `${label} ${count}`;
}

const container = document.getElementById('root');
const root = createRoot(container, { onUncaughtError: (error) => console.log(error.message) });
const show = (element) => {
  flushSync(() => root.render(element));
  console.log(container.textContent || '(nothing rendered)');
};

show(<Slots showFirst />); // → first middle undefined
show(<Slots showFirst={false} />); // → undefined first middle
show(<Gate loading />); // → Loading…
show(<Gate loading={false} />);
// → Rendered more hooks than during the previous render.
// → (nothing rendered)
```

React 19.3.1 in Chrome 156 and Firefox 159. `middle` silently received `'first'`, with no error or warning in either build. Before the `Gate` error, the development build also logged the hook-order warning. Production builds throw "Minified React error #310" instead of the message.

## Pitfalls

- An early `return` above a hook, typically `if (!user) return null;` before a `useEffect`. It works until the condition flips, then throws.
- Wrapping a hook in a condition "because it's only needed sometimes". Call it always and branch on its result, or move it into a conditionally rendered child.
- Calling a custom hook conditionally. It's the same violation: all the hooks inside it shift.
- Taking "no error" as "no bug". A swap between hooks of the same kind and count produces wrong state with no message at all.

## Follow-ups

**Q:** Why does `use` get an exception?
**A:** `use` doesn't take a slot in the hook list; it reads a promise or context passed to it directly, so its position doesn't matter. It can't go inside `try`/`catch`, and React 19.3 added a warning for some incorrect conditional uses.

**Q:** What happens if you call `useState` outside a component?
**A:** No component is rendering, so there's no dispatcher. In React 19.3.1 development builds log "Invalid hook call. Hooks can only be called inside of the body of a function component." and then a `TypeError` is thrown; production builds throw only the `TypeError`.

**Q:** Can a hook go in a loop with a fixed length?
**A:** The order would be stable, but the lint rule rejects it and a later change to the length breaks it. Render one child component per item instead; each gets its own hook list.

## Deep dive

### How it works

The docs describe the model as an array of state pairs plus an index reset to 0 before each render. React 19.3.1 implements it as a linked list (an implementation detail): the fiber's `memoizedState` points to the first `Hook` object, and each one holds `memoizedState`, `baseState`, `baseQueue`, `queue` and `next`.

- **Mount.** `mountWorkInProgressHook` creates a new `Hook` for each call and appends it to the list.
- **Update.** `updateWorkInProgressHook` walks the previous render's list in step with the calls: the *n*th call clones the *n*th hook. Nothing checks which hook created that slot; only position counts.
- **Too many calls.** When the previous list runs out, it throws `Rendered more hooks than during the previous render.`
- **Too few calls.** After the component returns, React checks whether the old list had hooks left over and throws `Rendered fewer hooks than expected…`.
- **Wrong kind.** A `useState` call landing on a slot that `useRef` created finds no update queue and throws "Should have a queue. You are likely calling Hooks conditionally, which is not allowed."

Development builds also record the name of every hook called and compare it with the last render; that's the source of the "change in the order of Hooks" warning, printed with a two-column table of the previous and next hook names.

Each update queue belongs to the hook object, not to the variable name, so a setter keeps updating the same slot even when, after a shift, a different variable reads that slot.

### Edge cases

Measured in React 19.3.1, Chrome 156 and Firefox 159:

| Case | Result |
|---|---|
| Same count, same kinds, order shifted | Wrong values, no error, no warning |
| 1 hook, then 2 | Throws "Rendered more hooks…" (prod: error #310), dev warning first |
| 2 hooks, then 1 | Throws "Rendered fewer hooks…" (prod: error #300) |
| `useState`, `useRef` swapped | Dev warning, then "Should have a queue…" (prod: error #311) |
| 0 hooks, then 1 | No error: a fiber with no hooks yet takes the mount path |

The last row is a trap. A component whose early `return` comes before *every* hook doesn't crash, so the bug ships; the lint rule still reports it as "called conditionally".

### Real-world scenario

A profile page renders `if (!user) return <Spinner />;` and below it `const initials = useMemo(…, [user])`. As long as an earlier hook such as `useState` sits above the return, the first render with a loaded user throws "Rendered more hooks". The lint output for that line is:

```text
React Hook "useMemo" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return?  react-hooks/rules-of-hooks
```

That's the message format from `eslint-plugin-react-hooks` 7.1.1 with ESLint 10.13. The fix: move every hook above the return and let them handle a missing `user`, or split the loaded state into `<ProfileDetails user={user} />`, whose hooks only ever run with a user.

### Trade-offs

Order-based identity buys a terse API: no keys to invent, and custom hooks compose without name clashes, because two calls to the same custom hook simply take different slots. The price is a static rule the language can't enforce, so it falls to the linter, and the code that would read most naturally ("only subscribe if enabled") must be restructured. When different modes need different state, render different components, or reset one with a `key`.
