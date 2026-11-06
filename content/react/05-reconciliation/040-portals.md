---
title: "How do Portals render outside the parent DOM node, and how do their events bubble?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [portals, create-portal, event-delegation, synthetic-events, context, modals]
related:
  - react/reconciliation/diffing-heuristics
  - react/context-and-composition/context-propagation
  - browser/events/event-dispatch-phases
  - browser/events/event-delegation
  - browser/events/default-actions-and-propagation
  - html-and-css/positioning-and-stacking/stacking-contexts
  - html-and-css/positioning-and-stacking/top-layer
verified: 2026-10
sources:
  - https://react.dev/reference/react-dom/createPortal#createportal
  - https://react.dev/reference/react-dom/createPortal#parameters
  - https://react.dev/reference/react-dom/createPortal#caveats
  - https://react.dev/reference/react-dom/createPortal#rendering-a-modal-dialog-with-a-portal
  - https://react.dev/reference/react-dom/createPortal#rendering-react-components-into-non-react-dom-nodes
  - https://legacy.reactjs.org/blog/2020/10/20/react-v17.html#changes-to-event-delegation
  - https://html.spec.whatwg.org/multipage/interactive-elements.html#show-a-modal-dialog
  - https://html.spec.whatwg.org/multipage/popover.html#show-popover
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/DOMPluginEventSystem.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js
tldr: >
  `createPortal(children, domNode)` puts the children's DOM nodes inside another, existing DOM
  node, such as `document.body`, while they stay where they were in the React tree. So context
  still reaches them and React events bubble to their React parents, even though native DOM
  events bubble through the DOM ancestors instead.
---

## Answer

`createPortal(children, domNode, key?)` from `react-dom` returns a React node. Wherever a component returns it, React renders `children` and places their DOM nodes inside `domNode` instead of inside the component's parent DOM element. The target must already exist; switching to a different node later recreates the portal's content.

A portal changes **only the physical DOM placement**. In every other way the children are still children of the component that rendered them:

- **Context** flows in: a `ThemeContext` provider above the component reaches components inside the portal.
- **React events bubble through the React tree.** A click inside a portal rendered into `document.body` reaches an `onClick` on the portal's React parent, although that `<div>` is nowhere near it in the DOM.
- **State and lifecycle** belong to the owning component: the portal mounts and unmounts with it.

What follows the DOM tree instead: native listeners (`addEventListener`, `contains()` checks), CSS inheritance and selectors, and layout. That's the point of portals: content escapes an ancestor's `overflow: hidden` or a stacking context that would clip or bury a tooltip, menu or modal.

React's own events work because of delegation. Since React 17, React attaches its listeners to the root container instead of `document`; a portal's container is usually outside the root, so in React 19.3.1 mounting a portal also attaches React's listeners to that container. React then walks the fiber tree, not the DOM, to find handlers.

For modals, check whether you need a portal at all: `<dialog>` opened with `showModal()`, and the `popover` attribute, put an element in the browser's top layer, above every stacking context, from wherever it sits in the DOM. Portals are still useful for rendering into a specific node, including one owned by non-React code. Either way, the modal still needs focus and keyboard handling.

## Example

```jsx
const Theme = createContext('light');

function Tooltip() {
  const theme = use(Theme);
  return createPortal(<button>theme: {theme}</button>, document.body);
}

function Card() {
  return (
    <div onClick={() => console.log('React onClick on the card')}>
      <Tooltip />
    </div>
  );
}

const container = document.getElementById('root');
createRoot(container).render(<Theme value="dark"><Card /></Theme>);
container.addEventListener('click', () => console.log('native listener on #root'));
// The <button> is a child of <body>, outside #root, and shows "theme: dark".
// Click it:
// → React onClick on the card
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted click. The native listener on `#root` didn't run: in the DOM, the button isn't inside `#root`. The React handler did, because in the React tree the button is inside the card.

## Pitfalls

- "Click outside to close" written as a native `document` listener with `menuRef.current.contains(event.target)`. Clicks inside a portaled submenu aren't DOM descendants, so the menu closes. Handle it through React events, or check the portal's node too.
- Expecting a portal to stop bubbling. A click in a modal also triggers `onClick` handlers on its React ancestors; call `e.stopPropagation()` at the portal's root, or render the portal higher up.
- Styling portal content with descendant selectors like `.card button`. It's no longer inside `.card` in the DOM, and it inherits fonts and colours from its new parent.
- Creating the target node during render or reading `document` during server rendering. The node must exist before the portal mounts, and there's no `document` on the server.

## Follow-ups

**Q:** Where does React attach event listeners?
**A:** Since React 17, on the root container, for both the capture and bubble phases. In React 19.3.1 mounting a portal also attaches them to its container: in the test, `#root` and `<body>` each got a capture and a bubble `click` listener (the source calls `listenToAllSupportedEvents` in `preparePortalMount`).

**Q:** Do native listeners on `document.body` see portal clicks?
**A:** Yes, by normal DOM bubbling, since the portal's DOM is inside `<body>`. A native listener on the same node as React's runs in registration order relative to React's.

**Q:** Can a portal target a node rendered by non-React code?
**A:** Yes, any existing DOM node, such as a map widget's popup element. React manages only the children it puts there.

## Exercises

### What logs?

```jsx
function Modal({ onClose }) {
  return createPortal(
    <div onClick={(e) => e.stopPropagation()}>
      <button onClick={onClose}>close</button>
    </div>,
    document.body,
  );
}

function Page() {
  return (
    <section onClick={() => console.log('section')}>
      <Modal onClose={() => console.log('close')} />
    </section>
  );
}
// Click "close".
```

**Answer:** Only `close`. The click bubbles through the React tree from the button to the portal's `<div>`, whose `stopPropagation()` stops it before it reaches `<section>`. Without that handler, `section` would log too, even though the `<section>` isn't a DOM ancestor of the button.
