---
title: "How do you find out why a component rendered?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [profiling, profiler, react-devtools, performance-tracks, re-render, debugging]
related:
  - react/rendering-model/when-components-rerender
  - react/rendering-model/render-and-commit
  - react/rendering-model/purity-and-strict-mode
  - react/effects/layout-effects
  - react/performance/memoization
  - react/performance/react-compiler
  - react/context-and-composition/context-performance
  - react/concurrent-rendering/scheduler
  - react/concurrent-rendering/transitions
verified: 2026-10
perishable:
  - Performance Tracks entry names and Changed Props messages in React 19.3.1
sources:
  - https://react.dev/reference/react/Profiler#caveats
  - https://react.dev/reference/react/Profiler#onrender-parameters
  - https://react.dev/reference/react/Profiler#measuring-rendering-performance-programmatically
  - https://react.dev/reference/dev-tools/react-performance-tracks#usage
  - https://react.dev/reference/dev-tools/react-performance-tracks#using-profiling-builds
  - https://react.dev/reference/dev-tools/react-performance-tracks#scheduler
  - https://react.dev/reference/dev-tools/react-performance-tracks#components
  - https://react.dev/reference/dev-tools/react-performance-tracks#changed-props
  - https://react.dev/blog/2025/10/01/react-19-2#performance-tracks
  - https://react.dev/learn/react-developer-tools#browser-extension
  - https://legacy.reactjs.org/blog/2018/09/10/introducing-the-react-profiler.html
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-devtools/CHANGELOG.md
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactProfilerTimer.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberPerformanceTrack.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberCommitWork.js
tldr: >
  Record the slow interaction. The React DevTools Profiler shows which components rendered in each
  commit, how long they took, and which props, state or hooks changed. React 19.2's Performance Tracks
  put the same data in the browser's Performance panel. `<Profiler onRender>` reports timings from
  code. All three work in development and the profiling build, not plain production.
---

## Answer

First find *which* components rendered and how long they took, then ask *why* each one did. There are three tools:

- **React DevTools Profiler** (browser extension). Record an interaction; for each commit it shows a flame chart and a ranked chart of the components that rendered and their durations. A setting records why each one rendered: which props, state or hooks changed. Another setting highlights components on screen as they render.
- **React Performance Tracks** (React 19.2). Record in the browser's Performance panel and React adds a **Scheduler ⚛** track (each update's priority, its Render, Commit and effects phases) and a **Components ⚛** flame graph. In development, clicking a render shows its changed props, and an update shows which component's `setState` scheduled it. It sits next to the browser's own main-thread data.
- **`<Profiler id onRender>`**. Wrap a subtree and React calls `onRender(id, phase, actualDuration, baseDuration, startTime, commitTime)` after each commit. Use it to collect numbers in code: tests, dashboards, a before/after comparison.

The answer is one of the three render causes: the component's own state, its parent rendering, or a context it reads. "Parent rendered, props deeply equal" is the case `memo` or the React Compiler fixes; a new object each render shows up as a changed prop.

None of this runs in a normal production build. Development builds work but are slower (and Strict Mode renders twice), so use them to find *which* and *why*, and the **profiling build** (`react-dom/profiling`) for *how long*. Long tasks and responsiveness metrics outside React belong to browser profiling and web performance.

## Example

```jsx
function Slow() {
  const end = performance.now() + 5;
  while (performance.now() < end); // 5 ms of work
  return <p>slow</p>;
}
const MemoSlow = memo(Slow);

function App() {
  const [n, setN] = useState(0);
  return <><button onClick={() => setN(n + 1)}>inc</button><Slow /><MemoSlow /></>;
}

function Measure() {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => setWidth(1), []);
  return <p>{width}</p>;
}

function onRender(id, phase) {
  console.log(id, phase);
}

createRoot(document.getElementById('root')).render(
  <Profiler id="app" onRender={onRender}><App /><Measure /></Profiler>,
);
// Mount → app mount, app nested-update
// Click "inc" → app update
```

Chrome 156 and Firefox 159, development build and profiling build of React 19.3.1, 6 page loads each. Logging the third and fourth arguments too: on the click, `actualDuration` was 5.0–5.3 ms in Chrome and `baseDuration` 10.2–11.0 ms: only `Slow` rendered, `MemoSlow` was skipped. Firefox reported whole milliseconds, 5–6 and 10–11. In the production build `onRender` was never called.

## Pitfalls

- Timing a development build. It's slower than production and Strict Mode doubles renders; take durations from the profiling build.
- Expecting `<Profiler>` to report in production. Without the profiling build, `onRender` is silently never called.
- Speeding up a slow component before asking why it rendered. Often the fix is to stop the render, not to make it cheaper.
- Leaving many `<Profiler>` wrappers in the tree. The docs note each one adds CPU and memory overhead.

## Follow-ups

**Q:** How do you profile a production build?
**A:** Use the profiling build: import `createRoot` from `react-dom/profiling` instead of `react-dom/client`, or alias it in the bundler as the docs recommend. `onRender` then fires and the Scheduler track appears; the Components track lists only components inside a `<Profiler>`.

**Q:** What does the `"nested-update"` phase mean?
**A:** The commit was for an update scheduled synchronously during the previous commit. `setWidth` in `useLayoutEffect` produced it; the same call in `useEffect` reported `"update"`.

**Q:** What do `actualDuration` and `baseDuration` tell you?
**A:** `actualDuration` is the time spent rendering the subtree in this commit; `baseDuration` estimates re-rendering all of it, from each component's most recent render time. A gap between them is memoization working.

**Q:** Can these tools run in headless tests?
**A:** `<Profiler>` and Performance Tracks can: the example ran in headless browsers, and the tracks were read from a recorded Chrome trace. The DevTools extension's Profiler and render highlighting are interactive and weren't run here.

## Deep dive

### How it works

When profiling is compiled in (development and profiling builds), React 19.3.1 times each fiber as it renders (`ReactProfilerTimer.js`, an implementation detail). `actualDuration` sums the fibers that rendered in this pass; a skipped fiber keeps its previous self-duration, which is summed into `baseDuration`. After the commit, `ReactFiberCommitWork.js` calls `onRender` with phase `"mount"` if the `<Profiler>` is new, `"update"` otherwise, and `"nested-update"` when the previous commit left a synchronous update pending.

Performance Tracks are written by `ReactFiberPerformanceTrack.js` through Chrome DevTools' extensibility API: `console.timeStamp` with a track name, or `performance.measure` with a `detail.devtools` object when an entry carries properties. A Chrome trace of the example, recorded with Puppeteer, listed:

| Build | Scheduler ⚛ | Components ⚛ |
|---|---|---|
| Development | yes | `App`, `Slow`, `Measure` |
| Profiling, with `<Profiler>` | yes | `App`, `Slow`, `Measure` |
| Profiling, no `<Profiler>` | yes | none |
| Production | none | none |

The Scheduler track had Blocking, Transition, Suspense and Idle subtracks, with entries such as Event: click, Update, Render and Commit. `Slow` appeared three times in the Components track: twice on mount, then once on the click; `MemoSlow` didn't render again.

### Real-world scenario

Finding why components rendered, from the trace alone. Development build, Chrome 156, one click:

```jsx
function Label({ text }) { return <p>{text}</p>; }
function Box({ style }) { return <p style={style}>box</p>; }
function Plain() { return <p>plain</p>; }

function App() {
  const [n, setN] = useState(0);
  return (
    <>
      <button onClick={() => setN(n + 1)}>inc</button>
      <Label text={n} />
      <Box style={{ color: 'teal' }} />
      <Plain />
    </>
  );
}
```

The entries for the click:

- **Update**: Component name `App`, Method name `setState()`. The cause at the top.
- **Label**: Changed Props, `- text 0`, `+ text 1`. A real change.
- **Box**: Changed Props, `style`: "Referentially unequal but deeply equal objects. Consider memoization." A new object with the same contents: hoist it, `useMemo` it, or let the compiler cache it.
- **Plain**: rendered, with no changed props listed. It rendered only because `App` did.

The 19.3.1 source also flags, once per page load, a component without an update of its own whose props were all deeply equal and whose render took over 100 ms: "This component received deeply equal props. It might benefit from useMemo or the React Compiler in its owner."

### Trade-offs

- **DevTools Profiler**: the quickest way to see why each component rendered, per commit, with no code changes. It's interactive only, and limited to React's view of the work.
- **Performance Tracks**: React's work in line with the browser's main thread, so a slow commit can be told apart from slow layout, scripts or network. Changed props appear only in development, and the tracks need a browser with the DevTools extensibility API; the trace here was recorded in Chrome.
- **`<Profiler>`**: programmatic and aggregable, so it fits tests and field monitoring on a profiling build. It reports durations, not reasons.
