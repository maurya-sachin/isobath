---
title: "How do transitions stop Suspense from showing a fallback again?"
status: draft
difficulty: hard
frequency: 3
core: false
tags: [suspense, transitions, use-transition, use-deferred-value, key, navigation]
related:
  - react/suspense/suspense-mechanics
  - react/suspense/use-api
  - react/concurrent-rendering/transitions
  - react/concurrent-rendering/deferred-value
  - react/concurrent-rendering/interruptible-rendering
  - react/concurrent-rendering/view-transition
  - react/reconciliation/preserving-and-resetting-state
verified: 2026-10
sources:
  - https://react.dev/reference/react/Suspense#caveats
  - https://react.dev/reference/react/Suspense#showing-stale-content-while-fresh-content-is-loading
  - https://react.dev/reference/react/Suspense#preventing-already-revealed-content-from-hiding
  - https://react.dev/reference/react/Suspense#indicating-that-a-transition-is-happening
  - https://react.dev/reference/react/Suspense#resetting-suspense-boundaries-on-navigation
  - https://react.dev/reference/react/Suspense#preventing-unwanted-fallbacks
  - https://react.dev/reference/react/useTransition#building-a-suspense-enabled-router
  - https://react.dev/reference/react/useDeferredValue#showing-stale-content-while-fresh-content-is-loading
  - https://react.dev/reference/react/use#re-fetching-data-in-client-components
tldr: >
  An urgent update that suspends replaces already-visible content with the nearest fallback. In a
  Transition, or a `useDeferredValue` re-render, React keeps the old UI on screen and commits only when
  the content is ready; `isPending` shows progress meanwhile. It doesn't wait for boundaries that are
  new in this update, and a changed `key` makes one new on purpose.
---

## Answer

Suspense decides what to show when something suspends, and the kind of update decides which outcome React accepts:

- **Urgent update** (a plain `setState` from a click): the user expects an immediate response, so React commits right away. If a boundary that's already showing content suspends, React hides that content and shows the fallback again. Navigating with a boundary near the root swaps the whole page for a spinner.
- **Transition** (`startTransition`, `useTransition`): the update is allowed to wait. If committing it would hide *already-revealed* content behind a fallback, React doesn't commit. The old UI stays on screen and interactive, and the new UI appears once the data has loaded. With `useTransition`, `isPending` is `true` meanwhile, so you can dim the page or show a progress bar.
- **`useDeferredValue`**: the background re-render with the new value is a Transition too. If it suspends, the user keeps seeing the stale value instead of a fallback.

Two limits matter:

1. **New boundaries still show their fallbacks.** A Transition only waits long enough not to hide what's already on screen. A `<Suspense>` that appears for the first time in this update shows its fallback immediately, so the new page can render its shell while its slower sections load.
2. **Different content should reset.** When the user navigates to *another* profile, the old profile staying visible may be wrong. Give the boundary (or a parent) `key={userId}`: a new key makes it a new boundary, so it shows its fallback even in a Transition.

Only non-urgent updates get this treatment; React never delays an urgent render. That's why Suspense-enabled routers wrap navigations in Transitions by default, and why refetching with `use` stores the new promise in state inside `startTransition`.

## Example

```jsx
function Bio({ user }) {
  const bio = use(fetchBio(user)); // cached per user; resolves after 300 ms
  useLayoutEffect(() => console.log('show', bio), [bio]);
  return <p>{bio}</p>;
}
function Spinner() {
  useLayoutEffect(() => console.log('show spinner'), []);
  return <p>Loading…</p>;
}
function Profile() {
  const [user, setUser] = useState('ann');
  const [isPending, startTransition] = useTransition();
  useLayoutEffect(() => console.log('commit', user, isPending));
  return (
    <>
      <button onClick={() => startTransition(() => setUser('bob'))}>Bob</button>
      <Suspense fallback={<Spinner />}><Bio user={user} /></Suspense>
    </>
  );
}
// → commit ann true
// → show bob's bio
// → commit bob false
// With <Suspense key={user} …>:
// → commit ann true
// → show spinner
// → commit bob false
// → show bob's bio
```

Logged after clicking Bob once Ann's bio was showing. Chrome 156 and Firefox 159, development and production builds of React 19.3.1. Without the key, Ann's bio stayed on screen for 300 ms while `isPending` was `true`; with it, the spinner replaced Ann's bio at once. With a plain `setUser`, the spinner showed in both versions.

## Pitfalls

- Navigating with a plain `setState`. Every already-revealed boundary that suspends flashes back to its fallback; mark navigations as Transitions.
- Expecting a Transition to wait for everything. A nested boundary that's new on the next page shows its fallback; only boundaries already showing content are protected.
- Forgetting a pending indicator. The old page stays put with no feedback until the data arrives; there's no timeout, and in a test a 5-second request kept the old page for 5 seconds. Use `isPending`.
- Fetching nested data only when its component renders. In a Transition that reset the boundary with `key`, React 19.3.1 didn't pre-render a nested section, so its request started only after the outer data arrived, 200 ms later. Start requests in the event handler.

## Follow-ups

**Q:** `useTransition` or `useDeferredValue` here?
**A:** The docs suggest Transitions for navigation, usually inside the router, and `useDeferredValue` in application code where one part of the UI may lag, such as search results under an input that must stay urgent.

**Q:** Can the user keep interacting while the Transition waits?
**A:** Yes. In a test, a counter click 200 ms into a pending navigation committed at once, over the old page with `isPending` still `true`; the navigation committed 300 ms later, keeping the new count.

**Q:** Why does a new boundary show its fallback even in a Transition?
**A:** Nothing was visible there, so showing a fallback hides nothing. Waiting for it would block the whole navigation on the slowest section.

## Exercises

### What does the user see, and when?

```jsx
function ArtistPage() {
  return (
    <>
      <Biography />  {/* data takes 200 ms */}
      <Suspense fallback={<p>albums loading</p>}>
        <Albums />   {/* data takes 1,000 ms */}
      </Suspense>
    </>
  );
}

<Suspense fallback={<p>page loading</p>}>
  <button onClick={() => startTransition(() => setPage('artist'))}>Open</button>
  {page === 'index' ? <p>index</p> : <ArtistPage />}
</Suspense>
```

**Answer:** The index stays for 200 ms; "page loading" never shows, because the outer boundary was already revealed and this is a Transition. Then the artist page appears with "albums loading", since that boundary is new, and the albums arrive at 1,000 ms. Chrome 156 and Firefox 159 showed the page at 202–218 ms and the albums at 1,005–1,019 ms after the click.
