---
title: "What do error boundaries catch, and what slips past them?"
status: draft
difficulty: medium
frequency: 4
core: true
tags: [error-boundaries, get-derived-state-from-error, component-did-catch, on-caught-error, on-uncaught-error, error-handling]
related:
  - react/suspense/suspense-mechanics
  - react/suspense/use-api
  - react/suspense/lazy
  - react/concurrent-rendering/transitions
  - react/forms-and-actions/actions
  - react/reconciliation/preserving-and-resetting-state
  - react/server-rendering/streaming-and-selective-hydration
  - javascript/errors-and-cleanup/async-error-boundaries
  - javascript/errors-and-cleanup/uncaught-errors
verified: 2026-10
perishable:
  - "No function-component error boundary API in React 19.3.1"
  - "eslint-plugin-react-hooks 7.1.1 has the error-boundaries rule"
sources:
  - https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
  - https://react.dev/reference/react/Component#static-getderivedstatefromerror
  - https://react.dev/reference/react/Component#static-getderivedstatefromerror-caveats
  - https://react.dev/reference/react/Component#componentdidcatch
  - https://react.dev/reference/react/Component#componentdidcatch-parameters
  - https://react.dev/reference/react/Component#componentdidcatch-caveats
  - https://react.dev/reference/react-dom/client/createRoot#parameters
  - https://react.dev/reference/react-dom/client/createRoot#error-logging-in-production
  - https://react.dev/reference/react/useTransition#displaying-an-error-to-users-with-error-boundary
  - https://react.dev/reference/react/use#displaying-an-error-with-an-error-boundary
  - https://react.dev/reference/react/Suspense#providing-a-fallback-for-server-errors-and-client-only-content
  - https://react.dev/blog/2024/12/05/react-19#error-handling
  - https://react.dev/blog/2024/04/25/react-19-upgrade-guide#errors-in-render-are-not-re-thrown
  - https://react.dev/reference/eslint-plugin-react-hooks/lints/error-boundaries
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberThrow.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberErrorLogger.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberWorkLoop.js
tldr: >
  An error boundary is a class component with `static getDerivedStateFromError` (and usually
  `componentDidCatch`). It catches errors thrown while React renders, commits or runs Effects for its
  descendants, including rejected `use` promises and failed Transitions. It misses event handlers,
  async callbacks, its own errors and server rendering. React 19 reports through `onCaughtError` and
  `onUncaughtError`.
---

## Answer

An **error boundary** is a class component that defines `static getDerivedStateFromError(error)`. When a descendant throws while React is working on the tree, React unwinds to the nearest boundary and renders its fallback in place of that subtree; the rest of the page keeps working.

- **`getDerivedStateFromError(error)`** runs during rendering and returns state that switches to the fallback. It must be pure: React may call it more than once.
- **`componentDidCatch(error, info)`** runs in the commit, once, for side effects such as reporting; `info.componentStack` says where it happened.

**Caught:** errors thrown while rendering descendants, in their lifecycle methods and Effects, from `use` with a rejected promise, from a `lazy` component whose load failed, and from a Transition started with `useTransition`'s `startTransition`, which is how errors in Actions reach the boundary.

**Not caught:**

- **Event handlers.** They run after rendering, outside React's work; use `try`/`catch`, or put the error in state and render it.
- **Asynchronous code**: `setTimeout`, promise callbacks, code after `await`. The boundary has the same limit as `try`/`catch`: it only sees throws while React is calling your code.
- **The boundary's own errors.** They go to the next boundary up.
- **Server rendering.** There, a server error falls back to the nearest `<Suspense>` and the client retries.

There is no Hook equivalent in React 19.3.1; write one boundary class (or use a library) and reuse it.

**Uncaught errors** unmount the whole root: the container is left empty. **Reporting** changed in React 19: errors are no longer rethrown. Caught errors go to `console.error`, uncaught ones to `window.reportError`, which fires the window `error` event. `createRoot` (and `hydrateRoot`) accept `onCaughtError`, `onUncaughtError` and `onRecoverableError` to send them to monitoring instead.

## Example

```jsx
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    console.log('componentDidCatch', error.message);
  }
  render() {
    return this.state.error ? <p>Something went wrong</p> : this.props.children;
  }
}
function Buggy() {
  const [crash, setCrash] = useState(false);
  if (crash) throw new Error('render');
  return (
    <>
      <button onClick={() => { throw new Error('handler'); }}>Handler</button>
      <button onClick={() => setTimeout(() => { throw new Error('timeout'); })}>Timeout</button>
      <button onClick={() => setCrash(true)}>Render</button>
    </>
  );
}
window.addEventListener('error', (event) => console.log('window error', event.error.message));
createRoot(document.getElementById('root'), {
  onCaughtError: (error) => console.log('onCaughtError', error.message),
}).render(<ErrorBoundary><Buggy /></ErrorBoundary>);
// → window error handler
// → window error timeout
// → onCaughtError render
// → componentDidCatch render
```

Logged after clicking Handler, Timeout, then Render. Chrome 156 and Firefox 159, development and production builds of React 19.3.1, served from `http://localhost`, trusted clicks. The buttons kept working after the first two errors; only the third replaced them with the fallback.

## Pitfalls

- Expecting a boundary to catch a failed `fetch` in an event handler or Effect callback. Catch it there and store it in state; `setState(() => { throw error; })` also rethrows it during rendering, where the boundary sees it.
- Side effects in `getDerivedStateFromError`. React called it twice for one render error in both builds; log in `componentDidCatch`, which ran once.
- Wrapping JSX in `try`/`catch` instead. Child components render later, so their errors never reach the `catch`; `eslint-plugin-react-hooks` 7.1.1 reports "Avoid constructing JSX within try/catch".
- A boundary that never resets. After the error it keeps showing the fallback; reset its state from a "Try again" button, or give it a `key` that changes on navigation.

## Follow-ups

**Q:** Why two methods instead of one?
**A:** `getDerivedStateFromError` runs in the render phase, so React can switch to the fallback before committing anything; it must stay pure. `componentDidCatch` runs after the commit, where side effects like logging are allowed.

**Q:** How do errors in Actions reach a boundary?
**A:** Use the `startTransition` from `useTransition`. An error thrown in its callback, or a rejected async callback, is rethrown when the component renders. In the test, the boundary showed the error after a click.

**Q:** What's `onRecoverableError` for?
**A:** Errors React recovered from by itself, such as a concurrent render that threw once and succeeded when retried synchronously, or hydration mismatches. Development builds say "There was an error during concurrent rendering but React was able to recover…"; the original error is in `error.cause`.

## Deep dive

### How it works

From `ReactFiberThrow.js` in React 19.3.1 (implementation details):

- When rendering throws something that isn't a promise, the work loop walks up from the failing fiber. The first class component with `getDerivedStateFromError`, or with `componentDidCatch` that hasn't failed already in this batch, is marked to capture.
- React queues a special update on it: its payload calls `getDerivedStateFromError(error)`, and its callback, run during the commit, calls the root's caught-error handler and then `componentDidCatch`. That's why `onCaughtError` logged before `componentDidCatch`.
- If no boundary is found, the update goes to the root with the payload `{ element: null }`: the root renders nothing, and its callback calls the uncaught-error handler.

Before showing a boundary's fallback, React renders the failed lanes once more, synchronously (`getLanesToRetrySynchronouslyOnError` in `ReactFiberWorkLoop.js`). In the test, a component that threw only on its first attempt rendered fine, and `onRecoverableError` fired instead of the boundary. The retry is also why `getDerivedStateFromError` ran twice.

The default handlers, from `ReactFiberErrorLogger.js`, explain the console:

| Situation | Development | Production |
|---|---|---|
| Caught | One `console.error`: the error, "The above error occurred in the <Buggy> component.", "React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary." | `console.error(error)` |
| Uncaught | `reportError(error)`, plus `console.warn` "An error occurred in the <Buggy> component." with a suggestion to add a boundary | `reportError(error)` |
| Recoverable | `reportError(error)` | `reportError(error)` |

Passing an option replaces the default: with `onUncaughtError` set, the window `error` event no longer fired. Caught errors didn't reach the window `error` event in either build.

Legacy: before React 19, errors in render were caught and rethrown, so a caught error showed up as an uncaught exception, and development logged the same error up to three times.

### Edge cases

Measured in Chrome 156 and Firefox 159, development and production:

| Thrown from | Result |
|---|---|
| Render of a descendant | Boundary fallback |
| `useEffect` setup | Boundary fallback |
| The boundary's own `render` | Parent boundary's fallback |
| `startTransition` callback (`useTransition`) | Boundary fallback |
| No boundary at all | Root emptied, `onUncaughtError` |
| Event handler | Window `error` event, UI unchanged |
| `setTimeout` callback | Window `error` event, UI unchanged |
| Rejected promise in an Effect | `unhandledrejection`, UI unchanged |

The async rows are the JavaScript rule, not a React one: by the time a callback runs, React has finished calling your component, so there's no stack frame of React's left to catch the throw.

To bring an async error into React, rethrow it from a state update:

```jsx
useEffect(() => {
  fetchProfile().catch((error) => {
    setState(() => { throw error; }); // thrown while React renders → boundary
  });
}, []);
```

In the test, with `fetchProfile` rejecting after 50 ms, the boundary showed "profile failed" and `onCaughtError` reported it, in both builds.

### Real-world scenario

A dashboard puts one boundary around the app shell (the "something broke, reload" page) and one around each widget, so a chart that crashes on malformed data leaves the rest usable. In production, root options send everything to monitoring:

```jsx
createRoot(container, {
  onCaughtError: (error, info) => report('caught', error, info.componentStack),
  onUncaughtError: (error, info) => report('uncaught', error, info.componentStack),
  onRecoverableError: (error, info) => report('recovered', error.cause ?? error, info.componentStack),
});
```

Event handler and async failures still need their own reporting, through the window `error` and `unhandledrejection` events or explicit `catch` blocks. Data loaded with `use` or a Suspense-enabled library rejects into the widget's boundary, so the widget shows its own error state with a "Try again" button that refetches and resets the boundary.

### Trade-offs

Boundaries make failure local and declarative, like Suspense does for loading: the tree decides where errors show. They only cover code React runs during rendering and commit, though, so imperative code still needs `try`/`catch`. Granularity is a design choice: around every component, they hide failures inside tiny broken rectangles; around the root only, one bad widget blanks the page. The class-only API is a small, fixed cost: one component, written once.
