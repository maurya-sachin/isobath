---
title: "How are file-based metadata routes (`opengraph-image`, `sitemap`) generated and cached?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [metadata-routes, opengraph-image, sitemap, image-response, caching]
related:
  - nextjs/optimizations/generate-metadata-streaming-dedup
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/rendering/generate-static-params-dynamic-params
  - nextjs/route-handlers-and-proxy/route-handler-vs-server-action
verified: 2026-11
perishable:
  - "16.4.5 sends public, max-age=0, must-revalidate on every metadata route"
  - "id from generateImageMetadata and generateSitemaps is a promise since 16"
  - "ImageResponse display allows flex, block, contents, none, -webkit-box"
sources:
  - https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image#generate-images-using-code-js-ts-tsx
  - https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image#config-exports
  - https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image#image-files-jpg-png-gif
  - https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap#generating-a-sitemap-using-code-js-ts
  - https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots#generate-a-robots-file
  - https://nextjs.org/docs/app/api-reference/functions/generate-image-metadata#id
  - https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps#urls
  - https://nextjs.org/docs/app/api-reference/functions/image-response#behavior
  - https://github.com/vercel/satori
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/build/webpack/loaders/next-metadata-route-loader.ts
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/build/webpack/loaders/next-metadata-image-loader.ts
tldr: >
  They're special route handlers, prerendered at build unless they read request data, make an
  uncached fetch, sit under an unlisted dynamic segment or set `force-dynamic`. Either way `next start`
  answers `Cache-Control: public, max-age=0, must-revalidate`, not a long cache. Pages link images as
  `/opengraph-image?<hash>`, and the hash tracks only that file's source.
---

## Answer

A `sitemap.js`, `robots.js` or `opengraph-image.jsx` in `app/` becomes a route handler at a fixed URL (`/sitemap.xml`, `/robots.txt`, `/opengraph-image`), and the build applies the usual static-or-dynamic rule to it. On Next.js 16.4.5 (Turbopack; `--webpack` matched):

- **Prerendered** (`○`): the root image, `sitemap.xml`, `robots.txt`, and an image whose plain `fetch` ran once, at build. Repeat requests returned the same bytes with `x-nextjs-cache: HIT`.
- **Per request** (`ƒ`): an image reading `cookies()`, one with a `no-store` fetch, one with `dynamic = 'force-dynamic'`, and `blog/[slug]/opengraph-image` with no `generateStaticParams`. Each request produced new bytes. A query string changes nothing: the image function receives only `params`.

The headers surprise people. Every metadata route, static or dynamic, sent `Cache-Control: public, max-age=0, must-revalidate` (the loader hard-codes it), with `image/png`, `application/xml` or `text/plain`. A CDN may store the file but must revalidate it every time.

For images, Next.js also writes the tags into the page: `og:image` with `?<hash>`, plus type, width, height and `og:image:alt` from the `size`, `contentType` and `alt` exports. The same image filled `twitter:image`, since there was no `twitter-image` file. The hash is the image file's content hash: editing that file changed it, but editing a component it imports, or rebuilding with new data, didn't.

Multiple outputs come from `generateImageMetadata` (ids `small` and `2` gave `/gim/opengraph-image/small` and `/2`, two sets of `og:image` tags) and `generateSitemaps` (`/products/sitemap/0.xml`; `/products/sitemap.xml` was a 404). Since 16, `id` arrives as a promise, and it resolved to a string even when the id was the number `2`.

`ImageResponse` renders with Satori, which supports flexbox and a subset of CSS. The docs also cap the bundle at 500 KB and allow only ttf, otf and woff fonts (not tested here).

## Example

```jsx
// app/opengraph-image.jsx
import { ImageResponse } from 'next/og';
export const alt = 'Acme home';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center',
      justifyContent: 'center', fontSize: 64, background: '#111', color: '#fff' }}>
      {`Generated ${new Date().toISOString()}`}
    </div>,
    size,
  );
}

// app/products/sitemap.js
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }];
}
export default async function sitemap({ id }) {
  const page = await id; // "1", a string
  return [{ url: `https://example.com/product/${page}`, lastModified: new Date() }];
}
```

The build listed `○ /opengraph-image` and `● /products/sitemap/0.xml`, `1.xml`. The timestamp in the PNG was the build's, on every request. The home page got `og:image` `https://example.com/opengraph-image?f62a60ed81245ece` (with `metadataBase` set), `width` 1200, `height` 630 and `og:image:alt` "Acme home".

## Pitfalls

- Expecting the generated image to be cached long-term like `/_next/static`. It's `max-age=0, must-revalidate`; set caching at the CDN if you want more.
- Using `display: 'grid'` in `ImageResponse`. A prerendered image failed the build: `Invalid value for CSS property "display". Allowed values: "flex" | "block" | "contents" | "none" | "-webkit-box"`. A dynamic one closed the connection with no status code at all.
- Trusting the `?hash` to bust social-preview caches. It only follows the image file's own source, not imported code or fetched data.
- Reading `searchParams` to vary an image. Image routes don't get them; `/opengraph-image?v=1` returned the cached build output.

## Follow-ups

**Q:** What turns `sitemap.js` dynamic?
**A:** The same things as any route: per the docs, a request-time API or a dynamic config option; here an uncached `fetch` and `cookies()` did it for images. A plain `fetch` kept the route static and ran once at build.

**Q:** What size limits apply to a static `opengraph-image.png`?
**A:** Per the docs and the loader source, the build fails above 8 MB for `opengraph-image` and 5 MB for `twitter-image` (not run here).

**Q:** How do you add alt text to a static image file?
**A:** A sibling `opengraph-image.alt.txt`, per the docs. For generated images, `export const alt` became `og:image:alt` and `twitter:image:alt`.
