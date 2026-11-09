# 08 — Images, fonts, scripts and metadata

> **Status:** 🔴 planned · **Published:** 0/5 · **Last verified:** —

What the Next.js optimization components and the Metadata API do for you, and what they still leave to you: `next/image`, `next/font`, `generateMetadata` with streaming, `next/script` strategies, and file-based metadata routes.

## Learning goals

After this chapter you can:

- Say what `next/image` does to an image and what you must still supply
- Explain how `next/font` avoids layout shift and third-party font requests
- Explain how `generateMetadata` interacts with streaming and request deduplication
- Explain what each `next/script` strategy changes about load order
- Explain how file-based metadata routes are generated and cached

## Sub-topics

Coverage checklist: each concept points to the questions covering it; `→ —` marks a gap.

- `next/image`: what it does and what you still supply → 010
- `next/font`: layout shift and font requests → 020
- `generateMetadata`, streaming and request deduplication → 030
- `next/script` strategies and load order → 040
- File-based metadata routes (`opengraph-image`, `sitemap`) → 050

## Questions

<!-- generated:questions:start -->
| # | Question | Difficulty | Status |
|---|---|---|---|
| 010 | [What does `next/image` do to an image, and what must you still supply?](010-next-image-responsibilities.md) | medium | 🟡 draft |
| 020 | [How does `next/font` avoid layout shift and third-party font requests?](020-next-font-layout-shift.md) | medium | 🟡 draft |
| 030 | [How does `generateMetadata` interact with streaming and request dedup?](030-generate-metadata-streaming-dedup.md) | hard | 🟡 draft |
| 040 | [What do the `next/script` strategies change about load order?](040-next-script-strategies.md) | medium | 🔴 planned |
| 050 | [How are file-based metadata routes (`opengraph-image`, `sitemap`) generated and cached?](050-file-based-metadata-routes.md) | medium | 🔴 planned |
<!-- generated:questions:end -->

## Sources

- [Next.js docs — `<Image>`](https://nextjs.org/docs/app/api-reference/components/image)
- [Next.js docs — `next/font`](https://nextjs.org/docs/app/api-reference/components/font)
- [Next.js docs — `<Script>`](https://nextjs.org/docs/app/api-reference/components/script)
- [Next.js docs — Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images)
- [Next.js docs — `generateMetadata`](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- [Next.js docs — `opengraph-image`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- [Next.js docs — `sitemap`](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)
