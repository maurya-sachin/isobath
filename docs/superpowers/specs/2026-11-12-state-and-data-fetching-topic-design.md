# State and data fetching topic (PLAN Phase 7)

Approved (section 7). It turns `content/state-and-data-fetching/README.md` → **Not yet mapped** into chapters and planned questions. No stubs or chapter READMEs exist until this spec is approved. Versions below were read from the npm registry (`npm view <pkg> version dist-tags time`) on 2026-11-12.

## 1. Target versions and drift
| Package | Target (`latest`) | Published |
|---|---|---|
| `react`, `react-dom` | 19.3.1 | 2026-11-11 |
| `@reduxjs/toolkit` / `redux` / `react-redux` | 2.14.0 / 5.0.1 / 9.3.1 | 2026-11-03 / 2024-05 / 2026-10-27 |
| `@tanstack/react-query` | 5.107.1 (peer React ^18 \|\| ^19) | 2026-11-06 |
| `zustand` | 5.1.0 | 2026-11-06 |
| `jotai` | 3.0.2 (3.0.0 on 2026-09-08) | 2026-11-09 |
| `@preact/signals-react` / `@preact/signals-core` | 3.12.0 / 1.14.5 | 2026-08 / 2026-10 |
| TC39 Signals (`signal-polyfill` 0.2.2) | Stage 1 (README header; its status section says "can currently be thought of as Stage 0") | polyfill 2025-01 |

- Node 24.19.0 (`app/.node-version`). Topic README gets `> **Covers:** React 19.3, Redux Toolkit 2.14, TanStack Query 5.107, Zustand 5.1, Jotai 3.0` (12 words).
- Each question names the library version it ran on; version-bound facts (defaults, option names, deprecations) go in `perishable`. Renamed APIs get the current name and one *Legacy:* sentence with the version that changed it. No version tables in questions.
- RTK Query is covered where it differs from TanStack Query (chapters 03, 05, 06), not as a parallel track. SWR 2.5.1 is mentioned at most in Follow-ups.

### Recent changes each writer must check against docs, not memory
| Change | Version | Source |
|---|---|---|
| `cacheTime` → `gcTime`; single object signature only; `status: 'loading'` → `'pending'`, `isLoading` = `isPending && isFetching`; `keepPreviousData` → `placeholderData: keepPreviousData`; `onSuccess`/`onError`/`onSettled` removed from `useQuery`; `initialPageParam` required; `useSuspenseQuery`; `isPlaceholderData`; `Hydrate` → `HydrationBoundary` | TanStack Query 5.0 | tanstack.com/query/v5/docs/framework/react/guides/migrating-to-v5 |
| Experimental: streaming/`useQuery().promise` with React `use`, `experimental_prefetchInRender`; check status in 5.107 | 5.x | guides/suspense, reference/useQuery |
| `createStore` deprecated in favour of `configureStore` (still works, struck through); `createSlice` builder-only `extraReducers`; `createSlice` `selectors` field; `combineSlices` + lazy slices; `createAsyncThunk` in `create.asyncThunk`; ESM-first packaging; action `type` must be a string | RTK 2.0 / Redux 5 | redux.js.org/usage/migrations/migrating-rtk-2 |
| `useSelector` dev checks: selector stability and identity-function warnings; built on `useSyncExternalStore` since 8.0 | react-redux 9 / 8 | react-redux.js.org/api/hooks |
| `create` with selectors returning new objects loops; `useShallow`; `createWithEqualityFn` moved to `zustand/traditional`; default export removed | Zustand 5.0 | zustand.docs.pmnd.rs/migrations/migrating-to-v5 |
| `persist` accepts async (`PromiseLike`) storage and migrations, `rehydrate()` returns `Promise<void>`; devtools `actionCreators` | Zustand 5.1 | github.com/pmndrs/zustand/releases/tag/v5.1.0 |
| ESM only, React 18+, Node 22.12+; `atomFamily` → `jotai-family` package; `loadable` and `setSelf` removed; `useAtomValue` mount timing changed | Jotai 3.0 | `pmndrs/jotai` docs/guides/migrating-to-v3.mdx |
| `use(promise)`, Actions, `useOptimistic`, `useActionState`; uSES guidance (no mutable sources in render, snapshot caching, transitions de-opt to sync) | React 19 | react.dev/reference/react |

## 2. Chapters
Two-digit folders, questions in steps of 10 (R2). Order: what kind of state it is, then client stores (primitive → Redux → lightweight), then server state (cache → freshness → writes → correctness → lists → server hand-off). 10 chapters, 51 questions.

| # | Chapter (folder) | Scope | Qs |
|---|---|---|---|
| 01 | Classifying state (`01-classifying-state`) | Local, shared, server, URL, form; derived state; where each lives | 5 |
| 02 | External stores and tearing (`02-external-stores`) | Subscriptions, `useSyncExternalStore`, snapshots, tearing, SSR snapshots | 5 |
| 03 | Redux and Redux Toolkit (`03-redux`) | Store, reducers, middleware, RTK, normalized state, memoized selectors | 6 |
| 04 | Lightweight stores and signals (`04-lightweight-stores`) | Zustand selectors, Jotai atoms, signals; re-render cost | 5 |
| 05 | Server state and the query cache (`05-server-state`) | QueryClient, keys, `staleTime` vs `gcTime`, observers, structural sharing | 6 |
| 06 | Invalidation and refetching (`06-invalidation`) | Refetch triggers, `invalidateQueries`, polling, RTK Query tags | 5 |
| 07 | Mutations and optimistic updates (`07-mutations`) | `useMutation`, optimistic cache vs UI, rollback, retries, ordering | 5 |
| 08 | Fetching correctness (`08-fetching-correctness`) | Races, cancellation, waterfalls, dedupe, retry and error states | 5 |
| 09 | Pagination and infinite queries (`09-pagination`) | Offset vs cursor, `placeholderData`, `useInfiniteQuery`, refetch of pages | 4 |
| 10 | Prefetching and hydration (`10-prefetching-and-hydration`) | Prefetch on intent and in loaders, `dehydrate`/`HydrationBoundary`, RSC hand-off, persistence | 5 |

Planned questions (title, then difficulty, frequency in brackets):

**01** 010 How do you decide whether a piece of state is local, shared, server, URL or form state? (medium, 5, core) · 020 Why is server data copied into a client store a bug waiting to happen? (medium, 4) · 030 When should state live in the URL, and what does that cost? (medium, 3) · 040 Where should form state live while the user types, and where after submit? (medium, 3) · 050 When is a global store the wrong answer, and what replaces it? (medium, 4)

**02** 010 What is an external store, and what contract does `useSyncExternalStore` require? (hard, 4, core) · 020 What is tearing, and how does concurrent rendering cause it? (hard, 4) · 030 Why must `getSnapshot` return a cached value, and what happens if it doesn't? (medium, 3) · 040 What does `getServerSnapshot` solve, and why must it match the first client render? (hard, 2) · 050 Why does a store update inside `startTransition` still render synchronously? (hard, 2)

**03** 010 What problem did Redux solve, and what does a reducer guarantee? (medium, 4) · 020 What does Redux Toolkit change compared to hand-written Redux? (medium, 5, core) · 030 How does middleware work, and where should side effects run? (hard, 3) · 040 Why does `useSelector` re-render, and how do memoized selectors fix it? (hard, 4) · 050 Why normalize state, and what does `createEntityAdapter` give you? (medium, 3) · 060 When is Redux still the right choice, and when isn't it? (medium, 4)

**04** 010 How does a Zustand store notify components, and what does a selector change? (medium, 4, core) · 020 Why does a selector that returns a new object cause extra renders or a loop? (medium, 3) · 030 How do Jotai atoms differ from a single store, and when is that better? (medium, 3) · 040 What are signals, and how do they skip React's re-render? (hard, 3) · 050 How do you compare re-render cost between context, Redux, Zustand and signals? (hard, 3)

**05** 010 Why is server state a different problem from client state? (medium, 5, core) · 020 How do query keys identify cache entries, and what goes wrong with bad keys? (medium, 4) · 030 What is the difference between `staleTime` and `gcTime`? (medium, 5) · 040 What do `isPending`, `isFetching` and `isLoading` mean, and which drives a spinner? (medium, 3) · 050 What is structural sharing, and why does it matter for re-renders? (hard, 2) · 060 How does RTK Query's cache model differ from TanStack Query's? (medium, 3)

**06** 010 When does TanStack Query refetch on its own, and how do you control it? (medium, 4, core) · 020 What does `invalidateQueries` do to active and inactive queries? (medium, 4) · 030 Invalidate or update the cache after a mutation: how do you choose? (medium, 4) · 040 How do polling and `refetchInterval` interact with focus and background tabs? (medium, 2) · 050 How do RTK Query tags drive invalidation? (medium, 3)

**07** 010 How do you implement an optimistic update with rollback? (hard, 5, core) · 020 Optimistic through the cache or through the UI: what is the difference? (medium, 3) · 030 Why cancel in-flight queries before an optimistic write? (hard, 3) · 040 What happens when two mutations to the same item overlap or retry? (hard, 3) · 050 How do `useOptimistic` and a query library's optimistic update fit together? (hard, 3)

**08** 010 How does a fetch in `useEffect` show stale data, and how do you fix the race? (medium, 5, core) · 020 How do you cancel a request, and what does cancellation actually stop? (medium, 4) · 030 What is a request waterfall, and how do you find and flatten one? (hard, 4) · 040 How does a query cache deduplicate requests, and when doesn't it? (medium, 3) · 050 How should retries, timeouts and error states behave for a query? (medium, 3)

**09** 010 Offset or cursor pagination: what breaks when data changes underneath? (medium, 4) · 020 How do you keep the old page on screen while the next one loads? (medium, 3) · 030 How does `useInfiniteQuery` store pages, and what happens on refetch? (hard, 3) · 040 How do you bound memory in a long infinite list? (hard, 2)

**10** 010 How do you prefetch data before the user needs it, and when is it wasteful? (medium, 4) · 020 How do you hydrate a client query cache from server-rendered data? (hard, 4, core) · 030 Why can hydrated data refetch immediately, and how does `staleTime` prevent it? (medium, 3) · 040 How do Server Components and a client query cache share data without double fetching? (hard, 3) · 050 What does persisting a query cache to storage buy, and what can it break? (medium, 2)

**Boundaries kept.** React owns `useState`, `useReducer`, context, rendering, Suspense, `use`, Actions and `useOptimistic` as primitives; these questions start from them and cover what stores and query libraries add. Next.js owns framework caches and Server Actions. `fetch`/`AbortController` semantics belong to browser; HTTP caching headers to HTTP and APIs.

## 3. Cross-topic links (`related`)
All ids confirmed by `ls` on 2026-11-12; re-confirm with `content:check` when written.

| Question | Links to |
|---|---|
| 01/010, 01/050 | `react/state/structuring-state`, `react/context-and-composition/context-performance` |
| 01/020 | `react/effects/you-might-not-need-an-effect` |
| 01/030 | `browser/navigation/history-api-routing`, `browser/navigation/navigation-api` |
| 01/040 | `react/forms-and-actions/controlled-vs-uncontrolled`, `react/forms-and-actions/use-action-state` |
| 02/010, 02/030 | `react/context-and-composition/custom-hooks`, `react/rendering-model/when-components-rerender` |
| 02/020, 02/050 | `react/concurrent-rendering/interruptible-rendering`, `react/concurrent-rendering/transitions` |
| 02/040, 10/020, 10/030 | `react/server-rendering/ssr-and-hydration`, `react/server-rendering/hydration-mismatches` |
| 03/010, 03/040 | `react/state/use-reducer`, `react/state/immutable-updates`, `react/performance/memoization` |
| 04/050 | `react/context-and-composition/context-performance`, `react/performance/react-compiler` |
| 05/040, 08/030 | `react/suspense/use-api`, `react/suspense/suspense-and-transitions` |
| 07/010, 07/050 | `react/forms-and-actions/use-optimistic`, `react/forms-and-actions/actions` |
| 06/030 | `nextjs/mutations/revalidation-apis-compared` |
| 08/010 | `react/effects/effect-cleanup`, `browser/network-apis/fetch-resolves-on-errors` |
| 08/020 | `browser/network-apis/fetch-request-options` |
| 10/010 | `nextjs/navigation/prefetch-and-partial-prefetching` |
| 10/040 | `react/server-components/rsc-serialization`, `nextjs/cache-components/use-cache-keys` |
| 10/050 | `browser/storage/choosing-browser-storage` |

## 4. Primary sources per chapter
Official docs and source at the pinned tag (`github.com/<repo>/tree/<tag>`); blog posts only to date a change.
- **01** react.dev learn/managing-state, choosing-the-state-structure, sharing-state-between-components; tkdodo.eu is not a source (TanStack docs guides are).
- **02** react.dev reference/react/useSyncExternalStore; `facebook/react` `v19.3.1` `packages/react-reconciler` (uSES implementation); `reactwg/react-18` discussion #69 (tearing, written by the React team).
- **03** redux.js.org: understanding/thinking-in-redux, usage/migrations/migrating-rtk-2, usage/deriving-data-selectors, usage/structuring-reducers/normalizing-state-shape; RTK api pages (configureStore, createSlice, createEntityAdapter, createListenerMiddleware), now under redux.js.org/toolkit/ (redux-toolkit.js.org 301-redirects there; cite the new URLs); react-redux.js.org api/hooks; `reduxjs/redux-toolkit` `v2.14.0`.
- **04** zustand.docs.pmnd.rs (guides/prevent-rerenders-with-use-shallow, migrations/migrating-to-v5); jotai.org docs + `pmndrs/jotai` `v3.0.2` docs/guides/migrating-to-v3.mdx; preactjs.com/guide/v10/signals; `preactjs/signals` README for `signals-react`; `tc39/proposal-signals` README.
- **05** tanstack.com/query/latest/docs/framework/react: overview, guides/important-defaults, query-keys, caching, render-optimizations, reference/useQuery, reference/QueryClient; `TanStack/query` `v5.107.1` `packages/query-core`; redux.js.org/toolkit/rtk-query/usage/cache-behavior, rtk-query/comparison.
- **06** TanStack guides: window-focus-refetching, query-invalidation, invalidations-from-mutations, updates-from-mutation-responses; RTK Query usage/automated-refetching.
- **07** TanStack guides: mutations, optimistic-updates, reference/useMutation (`scope`, `retry`); react.dev reference/react/useOptimistic.
- **08** react.dev learn/synchronizing-with-effects (fetching data), you-might-not-need-an-effect; TanStack guides: query-cancellation, query-retries, request-waterfalls, prefetching; MDN AbortController, `fetch` spec (fetch.spec.whatwg.org abort steps).
- **09** TanStack guides: paginated-queries, infinite-queries (`maxPages`), reference/useInfiniteQuery; redux.js.org/toolkit/rtk-query/usage/infinite-queries (the version that added it is ❓: the docs page doesn't say; check RTK release notes).
- **10** TanStack guides: prefetching, ssr, advanced-ssr, reference/hydration, plugins/persistQueryClient; react.dev useSyncExternalStore (server snapshot); nextjs.org App Router data-fetching docs only for the boundary.

## 5. Hands-on verification
Every behavioural claim runs in the scratchpad, never in the repo, with exact versions from Section 1 recorded in the question text.
- **Node-only (fast, no React):** `@tanstack/query-core` `QueryClient`/`QueryObserver`, Redux `configureStore`, `zustand/vanilla`, `jotai/vanilla` `createStore`, `@preact/signals-core`. Use for cache states, `staleTime`/`gcTime` timers (fake timers), invalidation of active vs inactive queries, dedupe, retry counts, structural sharing identity checks, reducer and middleware order.
- **React in a browser:** a Vite + React 19.3.1 app, production build (`vite build && vite preview`), driven by puppeteer-core in Chrome 156 and Firefox 159 as in PLAN Phase 7. StrictMode on and off where it changes the count. Use render counters (React Profiler `onRender` or a ref counter) for every re-render claim.

Traps to run, not reason about:
- **02** A mutable store read without uSES inside `startTransition` tears (two components show different values); with uSES it doesn't and the update de-opts to sync. `getSnapshot` returning a new object each call: the error message React 19.3 prints.
- **03** `useSelector` returning a new array: the react-redux 9 dev warning text; `createSelector` with an unstable input: the reselect dev check. `createStore` deprecation as shown by TypeScript/IDE (strike-through) vs runtime (none).
- **04** Zustand 5 selector returning `{a, b}` without `useShallow`: infinite loop or warning? Count renders with and without. Signals: does `@preact/signals-react` 3.12 work with React 19.3 without the Babel transform, and what does `useSignals` require?
- **05** Default `staleTime: 0`, `gcTime: 5 min`, `retry: 3` in browser vs 0 on server, `refetchOnWindowFocus` (the docs say it listens to `visibilitychange`; confirm a plain window `focus` does not trigger it). Status flags across first load, background refetch and error.
- **06** `invalidateQueries` refetches active queries only by default (`refetchType: 'active'`); inactive ones are only marked stale.
- **07** Optimistic update + rollback with a failing mutation; overlapping mutations with and without `scope` (serial execution).
- **08** Effect race without an ignore flag vs with `AbortController`; TanStack passing `signal` to `queryFn` and cancelling on unmount/key change; whether an unconsumed `signal` means the query keeps running.
- **09** `placeholderData: keepPreviousData` and `isPlaceholderData`; infinite query refetch refetches pages sequentially from the first; `maxPages` effect.
- **10** `dehydrate` → `HydrationBoundary` with `staleTime: 0`: immediate refetch on mount (Network count); with `staleTime: 60_000`: none.

## 6. How examples are shown
`examples:check` runs only `content/javascript` and `content/typescript`, so nothing here runs in CI.
- Code is `jsx`/`js`, as in React and Next.js. Library-free or vanilla-store code (Node-only list above) may carry `// →` lines copied from a real run; React component code never does: observed results (render counts, network requests) go in prose or a `text` block copied from the run.
- Each question states the library versions it ran on (e.g. "TanStack Query 5.107.1, React 19.3.1, Chrome 156"). One Example block, ≤ 30 lines.

## 7. Decisions
Approved 2026-11-12 by "go on": every recommendation below is adopted.

1. **Signals.** In or out? *Recommendation:* in, as one question (04/040) using `@preact/signals-core` for the mechanism plus one sentence that the TC39 proposal is Stage 1 (in `perishable`); no chapter of its own.
2. **Libraries in scope.** *Recommendation:* TanStack Query and Redux Toolkit as the main libraries, RTK Query only as a comparison (05/060, 06/050), Zustand and Jotai in chapter 04; SWR, MobX, Valtio, Recoil (archived) out except in Follow-ups.
3. **Redux depth.** *Recommendation:* 6 questions (chapter 03): RTK-first, hand-written Redux only to explain what RTK removes; no redux-saga/redux-observable questions (listener middleware covers side effects).
4. **URL and form state.** README scope lists them but no Not yet mapped item does. *Recommendation:* one question each in chapter 01 (01/030, 01/040); form libraries (React Hook Form) out.
5. **Topic size.** 51 questions. *Recommendation:* keep; to shrink, drop 02/040, 04/050, 09/040 and 10/050 first (lowest frequency).
