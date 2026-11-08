# 01 — App Router structure

> **Status:** 🔴 planned · **Published:** 0/6 · **Last verified:** —

How the App Router turns folders and special files into a component tree: layouts, templates, loading, error and not-found UI, route groups, parallel and intercepting routes.

## Learning goals

After this chapter you can:

- Explain how folders and special files become a component tree
- Explain why a layout keeps its state on navigation and when `template.js` is needed
- Map `loading.js`, `error.js` and `not-found.js` onto Suspense and error boundaries
- Explain parallel routes and why every slot needs a `default.js`
- Explain how intercepting routes give a modal its own URL that survives a refresh
- Explain what route groups and multiple root layouts change about navigation

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Folders and special files as a component tree → 010
- Layouts keep state on navigation; templates remount → 020
- `loading`, `error` and `not-found` as Suspense and error boundaries → 030
- Parallel routes (slots) and `default.js` → 040
- Intercepting routes for a modal with its own URL → 050
- Route groups and multiple root layouts → 060

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How does the App Router turn folders and special files into a component tree?](010-app-router-component-tree.md) | medium | 🟡 draft |
| 020 | [Why does a layout keep its state on navigation, and when do you need `template.js`?](020-layout-state-and-template.md) | medium | 🔴 planned |
| 030 | [How do `loading.js`, `error.js` and `not-found.js` map onto Suspense and error boundaries?](030-loading-error-not-found-boundaries.md) | medium | 🔴 planned |
| 040 | [What are parallel routes, and why must every slot have `default.js`?](040-parallel-routes-default.md) | hard | 🔴 planned |
| 050 | [How do intercepting routes give a modal its own URL that survives a refresh?](050-intercepting-routes-modal.md) | hard | 🔴 planned |
| 060 | [What do route groups and multiple root layouts change about navigation?](060-route-groups-root-layouts.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — Layouts and pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages)
- [Next.js docs — `layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout)
- [Next.js docs — `template.js`](https://nextjs.org/docs/app/api-reference/file-conventions/template)
- [Next.js docs — `loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
- [Next.js docs — `error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error)
- [Next.js docs — `not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found)
- [Next.js docs — `default.js`](https://nextjs.org/docs/app/api-reference/file-conventions/default)
- [Next.js docs — Parallel routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes)
- [Next.js docs — Intercepting routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes)
- [Next.js docs — Route groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)
