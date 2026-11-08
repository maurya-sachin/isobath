# Giscus theme from the palette (6A T6)

Approved by the maintainer 2026-11-08 ("go with your recommendations").

## Goal
The comments iframe uses the site's surfaces, text, borders and accent instead of GitHub's, in light and dark.

## Design
- `src/theme/giscus.ts` → `giscusThemeCss(mode)`: `@import` of giscus's own `https://giscus.app/themes/<mode>.css`, then a `main { … }` block overriding only the canvas, foreground, border, accent and button variables with `hex(mode, token)` from the palette (R23). Syntax, danger, success and attention colours stay giscus's.
- `npm run theme:build` writes `public/giscus/light.css` and `public/giscus/dark.css` (gitignored, like `favicon.svg`).
- `QuestionComments` passes `${location.origin}/giscus/<mode>.css` as `theme`; it renders only after hydration, so local builds and preview deploys load their own files.
- giscus adds the theme as `<link rel="stylesheet" crossorigin="anonymous">` inside its iframe (giscus ADVANCED-USAGE.md), so `vercel.json` sends `Access-Control-Allow-Origin: https://giscus.app` on `/giscus/(.*)`.

## Limits
- Default hue and normal contrast only: a reader's custom hue or high-contrast setting does not reach the iframe (that would need a file per hue).
- Fonts stay giscus's system stack; our web fonts are not loaded in the iframe.

## Verify
Production build served by the smoke server; a question page in Chrome and Firefox, light and dark: the iframe loads our stylesheet (200, no CORS error) and its canvas colour equals the palette's.
