---
title: "Why does an effect run twice in development, and how should cleanup work?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [use-effect, cleanup, strict-mode, data-fetching, race-condition, abort-controller]
related:
  - react/rendering-model/purity-and-strict-mode
  - react/effects/effect-timing
  - react/effects/effect-dependencies
  - react/effects/you-might-not-need-an-effect
  - react/refs/ref-callbacks-and-ref-prop
  - react/reconciliation/activity
  - react/suspense/use-api
  - javascript/async-and-the-event-loop/cancelling-async-work
verified: 2026-10
perishable:
  - "Strict Mode effect cleanup order observed in React 19.3.1"
sources:
  - https://react.dev/learn/synchronizing-with-effects#step-3-add-cleanup-if-needed
  - https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
  - https://react.dev/learn/synchronizing-with-effects#dont-use-refs-to-prevent-effects-from-firing
  - https://react.dev/learn/synchronizing-with-effects#fetching-data
  - https://react.dev/learn/synchronizing-with-effects#each-render-has-its-own-effects
  - https://react.dev/reference/react/useEffect#parameters
  - https://react.dev/reference/react/useEffect#caveats
  - https://react.dev/reference/react/useEffect#fetching-data-with-effects
  - https://react.dev/reference/react/useEffect#my-effect-runs-twice-when-the-component-mounts
  - https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development
  - https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-ref-callbacks-in-development
  - https://react.dev/reference/react/StrictMode#enabling-strict-mode-for-a-part-of-the-app
  - https://react.dev/blog/2022/03/29/react-v18#new-strict-mode-behaviors
  - https://react.dev/blog/2025/10/01/react-19-2#activity
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
tldr: >
  In development, Strict Mode follows a component's first mount with a simulated unmount and
  remount, keeping state: setup, cleanup, setup. It checks that cleanup undoes setup. Cleanup also
  runs before every re-run, with the previous render's values, and on unmount. Production runs
  setup once. Fix doubled work with cleanup, not a "has run" ref.
---

## Answer

**Why twice.** React may unmount and remount a component without the user noticing: navigating away and back, `<Activity>` hiding a tree and showing it again, saving the file in development. An effect that sets something up but never tears it down leaks a connection, a listener or a timer each time. To surface that early, Strict Mode in development runs every effect's **setup → cleanup → setup** when a component first mounts. State is kept, so only the effects (and, since React 19, ref callbacks) repeat. Production builds run setup once.

The right question isn't "how do I run it once?" but "does my effect survive a remount?" The test is that a user can't tell one setup from setup → cleanup → setup.

**What cleanup does.** Return a function that stops or undoes the setup: disconnect, remove the listener, clear the interval, destroy the widget, ignore or abort the request. React calls it:

- before running the effect again because a dependency changed. It's the closure from the previous render, so it sees the *previous* values;
- once when the component unmounts.

Within one commit, React runs every pending cleanup in the tree before any new setup.

**Data fetching races.** When `query` changes from `r` to `re`, two requests are in flight and the older one may answer last. Without cleanup, its `setResults` overwrites the newer result. Set an `ignore` flag in cleanup, or abort the request with an `AbortController`, so only the latest effect's response is applied. (Libraries and frameworks handle this, plus caching, for you.)

**Don't** use a ref to skip the second run. It hides the missing cleanup in development, and the leak still happens on real remounts. Work that must happen once per page load, not per mount, belongs outside components, at module level.

## Example

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState('');
  useEffect(() => {
    let ignore = false;
    fetch(`/search?q=${query}`)
      .then((response) => response.json())
      .then((json) => {
        console.log(json, ignore ? 'ignored' : 'applied');
        if (!ignore) setResults(json);
      });
    return () => { ignore = true; };
  }, [query]);
  return <p id="out">{results}</p>;
}

// Server: "r" answers after 300 ms, "re" after 100 ms
const root = createRoot(document.getElementById('root'));
root.render(<StrictMode><SearchResults query="r" /></StrictMode>);
setTimeout(() => root.render(<StrictMode><SearchResults query="re" /></StrictMode>), 50);
setTimeout(() => console.log('screen:', document.getElementById('out').textContent), 1000);
// → results for "re" applied
// → results for "r" ignored
// → results for "r" ignored
// → screen: results for "re"
```

Development build of React 19.3.1, Chrome 156 and Firefox 159, local Node server. Strict Mode fetched `r` twice; the first effect was cleaned up immediately. The production build logs one `r` line. Without the `if (!ignore)` check, the screen ended on `results for "r"` in both browsers.

## Pitfalls

- A `hasRun` ref or module flag to stop the double run. The effect then has no cleanup, and the bug ships.
- Cleanup that doesn't mirror setup: removing a listener with a different function than the one added, or clearing a different timer.
- Expecting cleanup to read the new props. It's the previous render's closure; that's what lets it disconnect from the *old* room.
- Treating "fetched twice in development" as a production problem. It's one extra request in development; fix it with cleanup or a caching layer.

## Follow-ups

**Q:** What do ignore flags and `AbortController` differ in?
**A:** An ignore flag lets the request finish and drops its result. `controller.abort()` in cleanup cancels the request; `fetch` then rejects with an `AbortError`, which you must catch. Abort also frees the network.

**Q:** Does wrapping only part of the app in `<StrictMode>` double its effects?
**A:** Not on the initial mount: React only does what can happen in production, and a child can't remount without its parent. Components mounted inside it later do get the extra cycle; both were confirmed in the test.

**Q:** Are layout effects and insertion effects doubled too?
**A:** Layout effects yes, in the same cycle. `useInsertionEffect` didn't repeat in the test (React 19.3.1).

## Deep dive

### How it works

After the first commit of a tree inside `<StrictMode>`, React 19.3.1's development build walks the newly mounted fibers and, for each, disconnects its layout effects, refs and passive effects, then reconnects them (`doubleInvokeEffectsOnFiber` in `ReactFiberWorkLoop.js`; an implementation detail). Nothing re-renders, so state and DOM survive. For a component with a layout effect, an effect and a ref callback on its `<div>`, the development build logged, in Chrome 156 and Firefox 159:

1. First mount: ref callback, layout effect, effect.
2. Simulated unmount: layout cleanup, ref cleanup, effect cleanup.
3. Simulated mount: ref callback, layout effect, effect.

On a normal update, passive effects run in two passes over the whole tree: every cleanup, then every setup.

```jsx
function Item({ name, v }) {
  useEffect(() => {
    console.log(`setup ${name} v=${v}`);
    return () => console.log(`cleanup ${name} v=${v}`);
  }, [v]);
  return null;
}
// Parent (same effect) renders <Item name="A" /> and <Item name="B" />; v goes from 1 to 2:
// → cleanup A v=1
// → cleanup B v=1
// → cleanup Parent v=1
// → setup A v=2
// → setup B v=2
// → setup Parent v=2
```

Same in both browsers and builds. The cleanups carry `v=1`: they're the functions the previous render's effects returned.

### Edge cases

- **Order on unmount is different.** Unmounting the whole tree logged `cleanup Parent` before `cleanup A`, and Strict Mode's simulated unmount did the same. Updates ran children's cleanups first. These orders are observations, not documented guarantees; don't let cleanups depend on each other.
- **Abort in Strict Mode.** With `AbortController`, the first `r` request was aborted by the simulated unmount and the second by the query change: two `AbortError` rejections, and the server saw both requests closed early.
- **Effects that can't be undone.** Analytics "page view" sent twice in development is acceptable; it's development only. Don't disable Strict Mode for it.

### Real-world scenario

A chat page connects in an effect. Without cleanup, development shows two "Connecting…" logs; in production the bug appears only after the user goes to Settings and back, and two connections receive every message. Returning `() => connection.disconnect()` fixes both, and the extra dev cycle becomes connect, disconnect, connect.

### Trade-offs

The double cycle costs development time: duplicate requests, louder logs. In exchange, missing cleanup fails on the first mount instead of after a navigation pattern nobody tested. Fetching in effects also leaves caching, deduplication and races to you; a framework's data layer, or a cached promise read with `use`, avoids most of it.
