# 10 — The Pages Router and migration

> **Status:** 🔴 planned · **Published:** 0/4 · **Last verified:** —

The Pages Router for legacy codebases: its data functions, `_app` and `_document`, how it coexists with the App Router, and what changes when a page moves into `app/`.

## Learning goals

After this chapter you can:

- Map `getStaticProps`, `getServerSideProps` and `getStaticPaths` to App Router code
- Explain what changes about data, layouts and client JavaScript when a page moves to `app/`
- Say what is and isn't shared when `pages/` and `app/` coexist
- Explain what `_app` and `_document` did and what replaces them

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- Pages Router data functions and their App Router equivalents → 010
- Moving a page to `app/`: data, layouts and client JS → 020
- Coexisting `pages/` and `app/` routers → 030
- `_app` and `_document` and their replacements → 040

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [How do `getStaticProps`, `getServerSideProps` and `getStaticPaths` map to App Router code?](010-data-functions-to-app-router.md) | medium | 🟡 draft |
| 020 | [What changes about data, layouts and client JavaScript when a page moves to `app/`?](020-moving-page-to-app.md) | medium | 🔴 planned |
| 030 | [Can `pages/` and `app/` coexist, and what isn't shared between them?](030-pages-and-app-coexistence.md) | medium | 🔴 planned |
| 040 | [What did `_app` and `_document` do, and what replaces them?](040-app-and-document-replacements.md) | easy | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — `getStaticProps`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-props)
- [Next.js docs — `getServerSideProps`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props)
- [Next.js docs — `getStaticPaths`](https://nextjs.org/docs/pages/building-your-application/data-fetching/get-static-paths)
- [Next.js docs — Custom `App`](https://nextjs.org/docs/pages/building-your-application/routing/custom-app)
- [Next.js docs — Custom `Document`](https://nextjs.org/docs/pages/building-your-application/routing/custom-document)
- [Next.js docs — App Router migration](https://nextjs.org/docs/app/guides/migrating/app-router-migration)
