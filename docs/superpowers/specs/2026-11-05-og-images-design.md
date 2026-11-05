# Per-question `og:image` (PLAN 6.3)

Shared links to a question page show a card with its title instead of a bare link.

## Output
- One 1200×630 PNG per question page, written at build to `dist/og/<topic>/<chapter>/<slug>.png` (mirrors the page path).
- Question pages add `og:image`, `og:image:width`, `og:image:height`, `og:image:alt` (the title) and `twitter:card` = `summary_large_image`. Other pages keep today's tags.

## Card
- Background `#F9FAFC`, foreground `#0E1424`, accent `#2F4FD8`: the light theme tokens (R13). Fixed light theme; no dark variant.
- Top: kicker `<Topic title> · <Chapter title>` in Geist 600. Middle: the question title in Newsreader, up to 3 lines (shrinks one size step for long titles). Bottom: wordmark text "isobath" and "by Sachin Maurya" in Geist, difficulty at right.
- Right edge: the topic's contour map (`contourRings`, same seed/levels/steepness as `TopicCover`) in the `--depth-*` ramp, cropped; decorative. Reusing the generator keeps the card and the topic page one visual language.

## Build
- `satori` (element tree → SVG) then `@resvg/resvg-js` (SVG → PNG). Both are devDependencies: they run only in `prerender.ts`.
- Fonts: static `@fontsource/geist` (600) and `@fontsource/newsreader` (500), latin `.woff`, read from `node_modules`. Satori renders a variable font at its default instance only, so the variable packages the app uses cannot give two weights. All SIL OFL.
- `scripts/lib/ogCard.ts` builds the element tree from plain data (pure, tested); `scripts/lib/ogImage.ts` renders PNG bytes; `prerender.ts` loops over question pages. The element tree is plain `{ type, props }` objects: scripts run on Node's native TypeScript, which has no JSX.
- Fail the build if a card can't render; never ship a page pointing at a missing image.

## Not doing
- Cards for topic, chapter, path or home pages (the home page gets none until there's a reason).
- A dark variant, per-theme images, or a title-length text-measuring pass beyond the one size step.
- Caching between builds: measure first; skip if the full run stays under a minute.
