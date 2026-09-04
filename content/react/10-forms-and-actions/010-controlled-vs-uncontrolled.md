---
title: "What is the difference between controlled and uncontrolled inputs?"
status: draft
difficulty: medium
frequency: 5
core: true
tags: [controlled-inputs, uncontrolled-inputs, default-value, forms, caret]
related:
  - react/state/state-as-snapshot
  - react/state/structuring-state
  - react/refs/refs-vs-state
  - react/reconciliation/preserving-and-resetting-state
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/deferred-value
  - react/forms-and-actions/actions
  - html-and-css/forms-dialog-popover/form-submission
  - html-and-css/forms-dialog-popover/input-types-and-autofill
verified: 2026-10
perishable:
  - "Warning texts as printed by React 19.3.1 development builds"
sources:
  - https://react.dev/reference/react-dom/components/input#props
  - https://react.dev/reference/react-dom/components/input#caveats
  - https://react.dev/reference/react-dom/components/input#providing-an-initial-value-for-an-input
  - https://react.dev/reference/react-dom/components/input#reading-the-input-values-when-submitting-a-form
  - https://react.dev/reference/react-dom/components/input#controlling-an-input-with-a-state-variable
  - https://react.dev/reference/react-dom/components/input#optimizing-re-rendering-on-every-keystroke
  - https://react.dev/reference/react-dom/components/input#my-text-input-doesnt-update-when-i-type-into-it
  - https://react.dev/reference/react-dom/components/input#my-input-caret-jumps-to-the-beginning-on-every-keystroke
  - https://react.dev/reference/react-dom/components/input#im-getting-an-error-a-component-is-changing-an-uncontrolled-input-to-be-controlled
  - https://react.dev/reference/react-dom/components/textarea#caveats
  - https://react.dev/reference/react-dom/components/select#caveats
  - https://react.dev/learn/sharing-state-between-components#controlled-and-uncontrolled-components
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/client/ReactDOMInput.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/ReactDOMControlledComponent.js
  - https://github.com/facebook/react/blob/v19.3.1/packages/react-dom-bindings/src/events/ReactDOMUpdateBatching.js
  - https://html.spec.whatwg.org/multipage/input.html#dom-input-value-value
tldr: >
  A controlled input gets `value` (or `checked`) from React state and reports edits through
  `onChange`; React forces the DOM back to that value after every change, so state is the single
  source of truth. An uncontrolled input keeps its own value in the DOM; `defaultValue` only sets the
  start; read it from a ref or `FormData`.
---

## Answer

The difference is who owns the current value.

**Uncontrolled:** the DOM does. `<input name="city" defaultValue="Paris" />` sets the initial value once; after that the browser keeps whatever the user types. You read it when you need it: from a ref, or with `FormData` when the form is submitted. Changing `defaultValue` in a later render doesn't change what's displayed.

**Controlled:** React state does. `<input value={name} onChange={(e) => setName(e.target.value)} />` displays exactly `name`. After each change event React re-renders and then resets the DOM to the `value` prop, so if your handler doesn't store the new text, the keystroke is undone. Use it when the UI depends on the value while the user types: live validation, a character count, fields that appear conditionally, formatting, or a "Clear" button.

The same split applies to `checked`/`defaultChecked` on checkboxes and radios, and to `<textarea>` and `<select>`, where `value`/`defaultValue` replace HTML's children and `selected`.

Rules React enforces in development:

- `value` without `onChange` renders a read-only field and logs an error; add `onChange`, `readOnly`, or use `defaultValue`.
- `value={undefined}` means uncontrolled. Starting with `useState()` and later setting a string switches the input to controlled, which React reports. `null` is also reported; use `''` for "empty".
- Update the state **synchronously** in `onChange`, with `e.target.value`. A setter called after an `await`, in a `setTimeout`, or with a transformed value makes React write the DOM, and the browser moves the caret to the end.

A controlled input re-renders its component on every keystroke. Keep that state in a small component, or use `useDeferredValue` for an expensive consumer. Uncontrolled fields avoid the renders and suit plain forms whose values are read only on submit, which React 19's form Actions make the default path.

## Example

```jsx
function Profile() {
  const [name, setName] = useState('Ada');
  const cityRef = useRef(null);
  function show() {
    console.log(JSON.stringify({ name, city: cityRef.current.value }));
  }
  return (
    <>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <input ref={cityRef} defaultValue="Paris" />
      <input value="fixed" />
      <button onClick={() => setName('')}>Clear name</button>
      <button onClick={show}>Show</button>
    </>
  );
}
// Type "!" at the end of each input, click Show:
// → {"name":"Ada!","city":"Paris!"}
// Click "Clear name", then Show:
// → {"name":"","city":"Paris!"}
```

Chrome 156 and Firefox 159, development and production builds of React 19.3.1, trusted key events. The third input still showed `fixed`; the development build logged "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`." State can clear `name`; nothing in state can clear `city`.

## Pitfalls

- Initialising state with `useState()` or `null` from an API. The input starts uncontrolled; use `''` or `value={text ?? ''}`.
- Setting the state after an `await` or a timer. The caret jumped to the end, and fast typing lost characters.
- Transforming in `onChange`, such as `setCode(e.target.value.toUpperCase())`. Typing in the middle sent the caret to the end.
- Expecting a new `defaultValue` to update the field. Remount it with a `key`, or make it controlled.

## Follow-ups

**Q:** How do you reset an uncontrolled input?
**A:** Change its `key` (or a parent's) so React mounts a fresh input with `defaultValue`, call `form.reset()`, or let a successful `<form action>` reset the form for you.

**Q:** Is `<input type="file">` controlled?
**A:** It can't be: browsers don't let scripts set a file input's value, apart from clearing it. Read `files` from a ref, the change event or `FormData`.

**Q:** What does `readOnly` change?
**A:** It's the HTML attribute: the user can't edit, and React stops warning about `value` without `onChange`. The value is still sent with the form, unlike `disabled`.

## Deep dive

### How it works

React's change handling ends with a restore step. Simplified from React 19.3.1's `ReactDOMUpdateBatching.js` and `ReactDOMInput.js` (implementation details):

```js
// after React has run your onChange for an event on a controlled input
flushSyncWork();                       // render and commit the updates you just made
restoreControlledState(input, props);  // props of the committed render

function updateInput(node, value) {
  if (value != null && node.value !== String(value)) {
    node.value = String(value);        // only when the DOM disagrees
  }
}
```

With a synchronous `setName(e.target.value)`, the flush renders the new value, which already matches the DOM, so React writes nothing and the caret stays where the user put it. When the handler sets nothing, or sets it later, the committed `value` is still the old one. React writes the old value back, and the HTML `value` setter moves the caret to the end whenever the value changes. When the late update arrives, React writes again.

Uncontrolled inputs get one write, at mount: React assigns `node.value` from `defaultValue`. That assignment sets the browser's dirty value flag, so later `defaultValue` changes only update the `value` attribute. In the test, rendering `defaultValue="two"` over an untouched `"one"` field left `"one"` on screen and `value="two"` in the attribute.

### Edge cases

Development warnings, verbatim from React 19.3.1 (production prints none):

| Code | Console error |
|---|---|
| `value` without `onChange` | "You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field…" |
| `checked` without `onChange` | The same, naming `checked` and `defaultChecked` |
| `value={null}` | "`value` prop on `input` should not be null. Consider using an empty string to clear the component or `undefined` for uncontrolled components." |
| `undefined` → string | "A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component." |
| string → `undefined` | "A component is changing a controlled input to be uncontrolled…" |

Both switches still happen: the input simply follows the new mode.

Late updates, measured by typing `abc`, placing the caret after `a` and typing `x`:

```jsx
setText(next);                              // → "axbc", caret 2
await null; setText(next);                  // → "axbc", caret 4
setTimeout(() => setText(next), 50);        // → "axbc", caret 4
setText(next.toUpperCase());                // → "AXBC", caret 4
// then six keys back to back, caret at the end:
setTimeout(() => setText(next), 50);        // → "axbci"
```

Chrome 156 and Firefox 159, development and production. Even a microtask is too late: the restore runs before it. With the timer, each keystroke was reverted before the next one arrived, so every keystroke replaced the previous one and only the last survived. A Transition is the same kind of late update: six keystrokes left just `f` in Chrome 156, while Firefox 159 kept all six (see the transitions question).

### Real-world scenario

A coupon field that must be upper case. Transforming in `onChange` is correct for the state but moves the caret. Two fixes: keep the typed text and show it with CSS `text-transform: uppercase`, normalising on submit; or put the caret back after React's write:

```jsx
function handleChange(e) {
  caretRef.current = e.target.selectionStart;
  setCode(e.target.value.toUpperCase());
}
useLayoutEffect(() => {
  if (caretRef.current !== null) {
    inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
  }
}, [code]);
// type "abc", caret after "A", type "x" → "AXBC", caret 2
```

The layout effect runs after the commit and before paint, so the jump is never visible. Masks for phone numbers need more, because formatting adds characters before the caret; that's where form or mask libraries earn their keep.

### Trade-offs

Controlled inputs make the value ordinary state: derive from it, validate as the user types, reset it, and keep it in sync with other UI. The cost is a render per keystroke and the synchronous-update rule. Uncontrolled inputs keep the browser in charge: no renders while typing, native validation and autofill work unchanged, and `FormData` collects everything on submit. The cost is that React can't see the value until you read it, and changing it from code means a ref or a remount. Many forms mix both: uncontrolled by default, controlled for the one field the UI must react to.

## Exercises

### Undefined start

```jsx
function Search() {
  const [query, setQuery] = useState();
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
// type "a"
```

**Answer:** The input works, but the development build logs "A component is changing an uncontrolled input to be controlled…" on the first keystroke: `value` went from `undefined` to `"a"`. Use `useState('')`.
