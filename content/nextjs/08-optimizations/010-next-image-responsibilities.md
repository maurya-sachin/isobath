---
title: "What does `next/image` do to an image, and what must you still supply?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [next-image, images, srcset, image-optimization, caching]
related:
  - nextjs/optimizations/next-font-layout-shift
  - nextjs/deployment/multi-instance-hosting
  - browser/observers/intersection-observer
verified: 2026-11
perishable:
  - "16.4.5 defaults: formats WebP only, qualities [75], minimumCacheTTL 14400"
  - "priority deprecated in favour of preload since Next.js 16"
  - "Local src with a query string needs localPatterns.search since 16"
  - "Missing width, height and alt checked only in development"
sources:
  - https://nextjs.org/docs/app/api-reference/components/image#sizes
  - https://nextjs.org/docs/app/api-reference/components/image#preload
  - https://nextjs.org/docs/app/api-reference/components/image#remotepatterns
  - https://nextjs.org/docs/app/api-reference/components/image#qualities
  - https://nextjs.org/docs/app/api-reference/components/image#formats
  - https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl
  - https://nextjs.org/docs/app/guides/upgrading/version-16#nextimage-changes
  - https://nextjs.org/docs/messages/next-image-unconfigured-host
  - https://github.com/vercel/next.js/blob/v16.4.5/packages/next/src/shared/lib/get-img-props.ts
tldr: >
  It renders an `<img>` whose `srcset` points at `/_next/image`, a server route that resizes,
  re-encodes by the `Accept` header (WebP by default) and caches on disk. It defaults to lazy
  loading. You still supply `width`/`height` or `fill`, a correct `sizes`, `alt`, allowed hosts,
  and `preload` on the LCP image.
---

## Answer

`next/image` is two things: a component that writes `<img>` markup, and an optimizer route, `/_next/image?url=…&w=…&q=…`, that produces the files the markup points at.

The component, on Next.js 16.4.5 (`next build && next start`):
- builds `srcset` from `deviceSizes` and `imageSizes`. A 400 px image without `sizes` got `w=640 1x, w=828 2x`; with `sizes`, nine `w` candidates from 384w to 3840w; `fill` without `sizes` got `sizes="100vw"` and device widths only.
- adds `loading="lazy"` and `decoding="async"` by default. `preload` (and the deprecated `priority`) drops `loading` and puts `<link rel="preload" as="image" imagesrcset>` in `<head>`. Neither adds `fetchpriority`.
- writes `width` and `height` to reserve space; for a static import it reads them, and a blur placeholder, at build.

The optimizer, per request:
- checks `url` against `localPatterns`/`remotePatterns`, `w` against the configured widths and `q` against `qualities` (default `[75]`). Anything else is a `400` such as `"q" parameter (quality) of 80 is not allowed`.
- resizes without upscaling (`w=3840` of a 1600 px source came back 1600 px wide) and picks the format from `Accept` and `images.formats`: WebP by default, AVIF only if configured, the original JPEG for `Accept: */*`.
- caches the result in `.next/cache/images` and sends `Cache-Control: public, max-age=14400, must-revalidate` (`minimumCacheTTL`, 4 hours since 16), or `max-age=315360000, immutable` for static imports, with `X-Nextjs-Cache: MISS`, then `HIT`.

What stays yours: dimensions or `fill` inside a positioned, sized parent; a `sizes` that matches the layout; real `alt` text; the host allowlists; and `preload` or `loading="eager"` on the one image that is the LCP element. Why those matter (LCP, CLS) belongs to Web performance. `next/image` only nags about them in development.

## Example

```jsx
// next.config.mjs
export default {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [new URL('https://avatars.githubusercontent.com/u/**')],
  },
};

// app/ex/page.jsx
import Image from 'next/image';
import hero from '../hero.jpg';

export default function Page() {
  return (
    <main>
      <Image src={hero} alt="Product hero" sizes="(max-width: 768px) 100vw, 50vw" preload />
      <Image src="/hero.jpg" alt="Thumbnail" width={400} height={225} />
      <div style={{ position: 'relative', width: 300, height: 200 }}>
        <Image src="/hero.jpg" alt="Card" fill />
      </div>
      <Image src="https://avatars.githubusercontent.com/u/14985020" alt="Avatar" width={96} height={96} />
    </main>
  );
}
```

`hero.jpg` is 1600×900. At a 1280×720 viewport, Chrome 156 and Firefox 159 both fetched `w=640` for the hero (50vw) and the thumbnail, and `w=1920` for the 300 px card, all as `image/avif`. Chrome fetched the below-the-fold avatar at once; Firefox waited until the page was scrolled. Both lazy-load thresholds are browser choices.

## Pitfalls

- Leaving out `sizes` on a `fill` image. It defaults to `100vw`, so the 300 px card downloaded the 1920w file.
- Trusting the development checks in production. `<Image src="/hero.jpg" quality={80} />` with no `width`, `height` or `alt` built silently and rendered an `<img>` with no `alt`, no dimensions, `sizes="100vw"` and `q=75`. The source throws for missing `width` only in development (not run here).
- An unlisted remote host. `next dev` returned 500: `hostname "images.unsplash.com" is not configured under images in your next.config.js`. The production page rendered, and its image request got `400 "url" parameter is not allowed`: a broken image, no error.
- Replacing a file at the same URL. The optimized copy is served until `minimumCacheTTL` runs out; there's no invalidation API, and the cache survived a rebuild (`HIT`).

## Follow-ups

**Q:** Why does `src="/hero.jpg?v=2"` break after upgrading to 16?
**A:** Local images with a query string now need a `localPatterns` entry with `search`. Without it the optimizer answered `400 "url" parameter is not allowed`.

**Q:** Where does the cache live when you run several instances?
**A:** On each instance's disk, in `.next/cache/images`, capped by `maximumDiskCacheSize`. Instances don't share it, so a CDN in front relies on `Cache-Control` and `Vary: Accept`, and must forward `Accept`.

**Q:** Is AVIF worth enabling?
**A:** Here it was 1,854 bytes against WebP's 3,178, but the first request took 88 ms to encode against 2 ms for a cache hit. Each format is cached separately. The docs still recommend WebP for most sites.

**Q:** Do `priority` and `preload` differ?
**A:** Not in output: both removed `loading` and added the same `<link rel="preload">`. `priority` is deprecated since 16; the docs suggest `loading="eager"` or `fetchPriority="high"` in most cases.
