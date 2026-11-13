---
title: "How does `next/font` avoid layout shift and third-party font requests?"
status: draft
difficulty: medium
frequency: 3
core: false
tags: [next-font, fonts, layout-shift, self-hosting, size-adjust]
related:
  - nextjs/optimizations/next-image-responsibilities
  - html-and-css/typography-colour-motion/font-matching
verified: 2026-11
perishable:
  - "Turbopack 16.4.5 ignores adjustFontFallback: false (issue 74134, PR 101397)"
  - "Turbopack 16.4.5 drops the adjusted face when fallback is set"
  - "display defaults to swap"
sources:
  - https://nextjs.org/docs/app/getting-started/fonts#google-fonts
  - https://nextjs.org/docs/app/api-reference/components/font#display
  - https://nextjs.org/docs/app/api-reference/components/font#adjustfontfallback
  - https://nextjs.org/docs/app/api-reference/components/font#css-variables
  - https://nextjs.org/docs/app/api-reference/components/font#preloading
  - https://github.com/vercel/next.js/issues/74134
  - https://github.com/vercel/next.js/pull/101397
  - https://github.com/vercel/next.js/issues/100221
tldr: >
  At build time it downloads Google's CSS and font files and serves them from your own origin,
  so browsers never contact Google. It preloads the chosen subsets, and emits a fallback face, a
  local Arial or Times New Roman rescaled with `size-adjust` and ascent/descent overrides, so text
  shown before the swap takes nearly the same space.
---

## Answer

`next/font` moves font loading into the build, and shrinks the shift that swapping fonts causes.

**Self-hosting.** During `next build`, `next/font/google` fetches Google's CSS and font files, writes the files to `/_next/static/media/` (served with `Cache-Control: public, max-age=31536000, immutable`) and puts the `@font-face` rules into the route's CSS. Loading the pages in Chrome 156 and Firefox 159 produced requests to the app's own origin only, none to `fonts.googleapis.com` or `fonts.gstatic.com`. That removes a third-party connection and the CSS-then-font request chain, and visitors' IP addresses never reach Google. `next/font/local` does the same for your own files.

**Preloading.** The files for the `subsets` you list get `<link rel="preload" as="font" crossorigin>`, on routes whose modules call the font function. The other subsets Google publishes are declared with `unicode-range` and fetched only if the text needs them: Inter got seven faces and one preload.

**Less shift.** Faces default to `font-display: swap`: text paints at once in a fallback and is redrawn when the font arrives. To make that redraw move little, Next adds a face named `Inter Fallback` that points at `local(Arial)` and rescales it with `size-adjust`, `ascent-override`, `descent-override` and `line-gap-override` values matched to Inter. The returned class sets `font-family: Inter, Inter Fallback`. At 18 px, a 60-character line measured 517.5 px in Inter, 515.5 px in `Inter Fallback` and 481.3 px in plain Arial. In Chrome, a 360 px-wide paragraph was 147 px tall in both Inter and its fallback.

The function returns `className`, `style` and, with `variable`, a class that declares a custom property for CSS or Tailwind to use. How CLS is scored belongs to Web performance.

## Example

```jsx
// app/lib/fonts.js
import { Inter } from 'next/font/google';

export const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// app/layout.jsx
import { inter } from './lib/fonts';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body style={{ fontFamily: 'var(--font-inter)' }}>{children}</body>
    </html>
  );
}
```

On Next.js 16.4.5 (Turbopack, `next build && next start`), the CSS chunk held seven `font-display:swap` faces for Inter, one per Google subset, plus `.BYr8Wa_variable{--font-inter:"Inter", "Inter Fallback"}`. The HTML preloaded one file, the Latin subset.

## Pitfalls

- Expecting zero shift everywhere. In Firefox 159 the paragraph was 161 px tall in Inter and 152.9 px in `Inter Fallback`: the overrides matched widths, but Inter's normal line height still came out 2 px taller there.
- `adjustFontFallback: false` with Turbopack, the default builder. Lora still got a `Lora Fallback` face; `next build --webpack` left it out. An open issue (#74134) and PR (#101397) trace it to the option never being read.
- Setting `fallback` under Turbopack. Roboto with `fallback: ['system-ui']` got `font-family: Roboto, system-ui` and no adjusted face at all (issue #100221; webpack emits both).
- One shared fonts module defining three fonts. Every route importing it preloaded all three files, even a page using one.

## Follow-ups

**Q:** Does `next/font` remove the flash of fallback text?
**A:** No. With `swap` the fallback still paints first; the adjusted face only makes the redraw smaller. `display: 'optional'` lets the browser skip the font on a slow first load instead (per the CSS spec, not run here).

**Q:** Why was Lora's fallback Times New Roman?
**A:** Next picks Arial for sans-serif families and Times New Roman for serif ones, then computes the overrides from metrics it bundles for each Google font. Lora got `size-adjust: 115.2%` on `local(Times New Roman)`.

**Q:** Does `next/font/local` adjust fallbacks too?
**A:** Per the docs, yes: `adjustFontFallback` defaults to `'Arial'` and accepts `'Times New Roman'` or `false` (not run here).

## Exercises

### Read the generated fallback face

```css
@font-face {
  font-family: Inter Fallback;
  src: local(Arial);
  ascent-override: 90.44%;
  descent-override: 22.52%;
  line-gap-override: 0.0%;
  size-adjust: 107.12%;
}
```

Which file does the browser download for this face, and what does `size-adjust: 107.12%` change?

**Answer:** None: `local(Arial)` uses the installed system font. `size-adjust` scales Arial's glyphs by 107.12% so a line of it is about as wide as Inter (515.5 px against 517.5 px at 18 px; plain Arial was 481.3 px).
