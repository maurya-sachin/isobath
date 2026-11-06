---
title: "When do you need `useLayoutEffect` instead of `useEffect`?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [use-layout-effect, use-insertion-effect, paint, measuring-layout, server-rendering]
related:
  - react/rendering-model/render-and-commit
  - react/effects/effect-timing
  - react/effects/effect-cleanup
  - react/refs/refs-vs-state
  - react/server-rendering/ssr-and-hydration
  - browser/rendering-pipeline/forced-synchronous-layout
  - browser/html-event-loop/request-animation-frame
verified: 2026-10
perishable:
  - "React 19.0 removed the server useLayoutEffect warning"
  - "Tooltip flicker rate with useEffect: Chrome 156 3/10, Firefox 159 0/10"
sources:
  - https://react.dev/reference/react/useLayoutEffect#parameters
  - https://react.dev/reference/react/useLayoutEffect#caveats
  - https://react.dev/reference/react/useLayoutEffect#measuring-layout-before-the-browser-repaints-the-screen
  - https://react.dev/reference/react/useLayoutEffect#uselayouteffect-blocks-the-browser-from-repainting
  - https://react.dev/reference/react/useLayoutEffect#im-getting-an-error-uselayouteffect-does-nothing-on-the-server
  - https://react.dev/reference/react/useEffect#my-effect-does-something-visual-and-i-see-a-flicker-before-it-runs
  - https://react.dev/reference/react/useInsertionEffect#caveats
  - https://react.dev/reference/react/useInsertionEffect#injecting-dynamic-styles-from-css-in-js-libraries
  - https://react.dev/blog/2022/03/29/react-v18#useinsertioneffect
  - https://github.com/facebook/react/blob/v19.3.1/CHANGELOG.md
tldr: >
  When the effect changes what the user sees and the first frame must already be right: measuring
  a tooltip and repositioning it, restoring scroll. `useLayoutEffect` runs after React updates the
  DOM but before the browser paints, and state updates it schedules render before paint too. It
  blocks paint, so it's the exception. `useInsertionEffect` is for CSS-in-JS libraries.
---

## Answer

The two hooks take the same arguments and follow the same dependency and cleanup rules. Only the timing differs.

**`useLayoutEffect`** runs inside the commit: after React has changed the DOM and attached refs, before the browser can paint. Any state update it schedules is rendered and committed synchronously, still before paint, and React runs pending `useEffect` callbacks first. So the user only ever sees the final result.

**`useEffect`** usually runs in a later task, and the browser may paint in between. If the effect corrects something visible, that painted frame is the flicker.

Use the layout version when you must **read layout and render based on it before the user sees anything**:

- measure a tooltip or popover, then place it above or below its anchor;
- restore or adjust a scroll position after new content renders;
- synchronise DOM state that must never be shown half-done.

**The cost.** The browser can't paint until the layout effect and its updates finish, so slow work there delays every frame of that update. Measuring also forces the browser to compute style and layout synchronously. Prefer `useEffect`; switch only for a visible flicker.

**Server rendering.** Neither hook runs on the server. React 19 removed the old "useLayoutEffect does nothing on the server" warning. The underlying problem remains: the server HTML can't contain the measured result, so it jumps after hydration. Render such components only on the client, or accept `useEffect`.

**`useInsertionEffect`** runs even earlier, before any layout effect. It exists for CSS-in-JS libraries that inject `<style>` tags at runtime, so styles are in place before layout effects read layout. Refs aren't attached yet when it runs, it can't schedule updates, and it may run before or after the DOM is updated. Application code shouldn't need it.

## Example

```jsx
function Tooltip() {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);
  const top = 100 - height; // sit just above y = 100
  console.log('render, top =', top);
  useLayoutEffect(() => {
    requestAnimationFrame(() => console.log('next frame shows top =', ref.current.style.top));
    setHeight(ref.current.getBoundingClientRect().height);
  }, []);
  return <div ref={ref} style={{ position: 'absolute', top, height: 40 }}>Saved</div>;
}

setTimeout(() => createRoot(document.getElementById('root')).render(<Tooltip />), 50);
// → render, top = 100
// → render, top = 60
// → next frame shows top = 60px
```

Same in 10 of 10 headless runs each in Chrome 156 and Firefox 159, development and production builds of React 19.3.1. With `useEffect` instead, the next frame showed `top = 100px` before the corrected render in 3 of 10 Chrome runs (both builds) and 0 of 10 Firefox runs: a race the user sees as a flicker.

## Pitfalls

- Making `useLayoutEffect` the default "to be safe". It delays paint for every update that triggers it.
- Measuring in `useEffect` and testing on a fast machine. Whether the wrong frame shows depends on frame timing.
- Writing styles and reading geometry in alternation inside the effect: each read forces another synchronous layout. Read first, then write.
- Using a layout effect in a server-rendered component to "fix" content before display. The server HTML shows the unmeasured state until the client runs it.

## Follow-ups

**Q:** Is `ref.current` set inside `useLayoutEffect`?
**A:** Yes. React attaches refs in the same commit phase, before layout effects run; in the test a ref callback on the child `<div>` logged before the component's layout effect. In `useInsertionEffect`, `ref.current` was still `null` on mount.

**Q:** What happens if `useInsertionEffect` sets state?
**A:** It's unsupported. In React 19.3.1's development build, React logged "useInsertionEffect must not schedule updates." Don't rely on what happens next.

**Q:** Does `renderToString` still warn about `useLayoutEffect`?
**A:** No. React 19.0's changelog lists "Remove layout effect warning on server". In Node 24 with React 19.3.1, rendering a component with all three effect hooks printed nothing and ran none of them.

**Q:** How do insertion effects clean up?
**A:** One component at a time: cleanup then setup per component, interleaved. Other effect types run every cleanup in the tree before any setup.
