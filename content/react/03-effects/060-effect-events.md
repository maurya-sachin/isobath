---
title: "What problem does `useEffectEvent` solve?"
status: draft
difficulty: hard
frequency: 2
core: false
tags: [use-effect-event, effect-events, reactive-values, dependencies, stale-closure]
related:
  - react/effects/effect-dependencies
  - react/effects/effect-timing
  - react/effects/effect-cleanup
  - react/effects/you-might-not-need-an-effect
  - react/refs/refs-vs-state
  - javascript/closures/what-is-a-closure
verified: 2026-10
perishable:
  - "useEffectEvent stable since React 19.2"
  - "eslint-plugin-react-hooks 7.1.1 messages for Effect Events"
sources:
  - https://react.dev/learn/separating-events-from-effects#reactive-values-and-reactive-logic
  - https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
  - https://react.dev/learn/separating-events-from-effects#is-it-okay-to-suppress-the-dependency-linter-instead
  - https://react.dev/learn/separating-events-from-effects#limitations-of-effect-events
  - https://react.dev/reference/react/useEffectEvent#parameters
  - https://react.dev/reference/react/useEffectEvent#returns
  - https://react.dev/reference/react/useEffectEvent#caveats
  - https://react.dev/reference/react/useEffectEvent#why-are-effect-events-not-stable
  - https://react.dev/reference/react/useEffectEvent#pitfall-skip-dependencies
  - https://react.dev/reference/react/useEffectEvent#effect-event-in-deps
  - https://react.dev/reference/react/useEffectEvent#effect-event-called-outside-effect
  - https://react.dev/blog/2025/10/01/react-19-2#use-effect-event
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-reconciler/src/ReactFiberHooks.js
tldr: >
  An effect re-runs when any value it reads changes, even one used only in a callback it fires,
  like the theme of a "connected" toast. `useEffectEvent` moves that logic into an Effect Event: it
  sees the latest props and state and isn't a dependency. Call it only from effects; never use it
  to hide a real dependency.
---

## Answer

Code in an effect is **reactive**: every prop, state or render-scope value it reads is a dependency, and a change re-runs the effect. Code in an event handler isn't: it runs when the user acts and reads whatever the latest values are.

Some effects contain a bit of event-like logic. A chat room connects in an effect keyed on `roomId`; when the connection opens, it shows a notification in the current `theme`. The connection should follow `roomId`, but not `theme`:

- List `theme` and every theme switch disconnects and reconnects.
- Leave it out and `react-hooks/exhaustive-deps` warns, and the notification uses the theme from when the effect ran: a stale closure.

**`useEffectEvent`** splits the two. Wrap the notification in `const onConnected = useEffectEvent(() => showNotification('Connected!', theme))` and call `onConnected()` from the effect. When called, it runs the callback from the latest committed render, so it sees the current `theme`, and it is not a dependency. The effect lists only `roomId`. It's stable since React 19.2.

**The rules**, enforced by eslint-plugin-react-hooks:

- Call it only from inside `useEffect`, `useLayoutEffect`, `useInsertionEffect`, or another Effect Event in the same component. Not from handlers, not during render (that throws), not passed to children or other hooks.
- Never list it as a dependency. Its identity changes on every render, deliberately, so misuse shows up as an effect re-running each render.
- Use it only for logic that really is an event fired by the effect. Wrapping code just to drop a dependency the effect should react to hides bugs: a visit logged without `url` in its dependencies misses page changes.

Before it existed, most code disabled the lint rule and left the value out, as the React 19.2 announcement notes; the linter then stopped checking that effect.

## Example

```jsx
function createConnection(roomId) { // fake server: connects after 100 ms
  let timer, onConnected;
  return {
    on(event, callback) { onConnected = callback; },
    connect() { console.log('connect', roomId); timer = setTimeout(() => onConnected(), 100); },
    disconnect() { console.log('disconnect', roomId); clearTimeout(timer); },
  };
}

function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    console.log('connected, notify in', theme);
  });
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', () => onConnected());
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // theme isn't a dependency
  return null;
}

const root = createRoot(document.getElementById('root'));
root.render(<ChatRoom roomId="general" theme="light" />);
setTimeout(() => root.render(<ChatRoom roomId="general" theme="dark" />), 50);
// → connect general
// → connected, notify in dark
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, no Strict Mode; ESLint with the 7.1.1 recommended preset reported nothing. With `theme` read directly and listed as a dependency, the log was `connect`, `disconnect`, `connect`, then `dark`. Read directly but not listed, it printed `light`.

## Pitfalls

- Using `useEffectEvent` to silence `exhaustive-deps` for a value that should re-sync the effect. The linter goes quiet and the bug stays.
- Adding the Effect Event to the dependency array. Its identity is new every render, so the effect would re-run every render; the linter warns "Functions returned from `useEffectEvent` must not be included in the dependency array."
- Passing it to a child or a custom hook. The linter reports an error; declare the Effect Event next to the effect that uses it.
- Calling it during render. React throws "A function wrapped in useEffectEvent can't be called during rendering."

## Follow-ups

**Q:** Why isn't the returned function stable, like a `useState` setter?
**A:** On purpose: a stable identity would let misuse go unnoticed. In React 19.3.1 each render returns a new wrapper that calls a shared, internal ref, updated during the commit; identity checks between renders were `false` (implementation detail).

**Q:** What happens if you call it from a click handler?
**A:** The linter reports "`onConnected` is a function created with React Hook "useEffectEvent", and can only be called from Effects and Effect Events in the same component". At runtime in React 19.3.1 a call outside render didn't throw, but that's unsupported; use a normal function.

**Q:** Which values does it see inside a layout effect?
**A:** The latest committed render's. In the test, a layout effect and an effect both saw the current render's props through the Effect Event.
