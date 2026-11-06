# SEO (PLAN 6B Q1)

Make every page easy to find, preview and trust, without changing what readers see.

## Head tags
- Meta descriptions are cut at 155 characters on a word boundary with "…"; whitespace collapsed. The prerender fails if two pages share a title or a description.
- `theme-color` for light and dark (`media="(prefers-color-scheme: …)"`), from the palette's page background.
- Content pages add `robots` `index, follow, max-image-preview:large`; `app-shell` and `404.html` stay `noindex`.

## Structured data (JSON-LD, one `<script type="application/ld+json">` per page)
- Home: `WebSite` (name, url, description) and the author as `Person`.
- Topic, chapter, question: `BreadcrumbList` matching the on-page breadcrumbs.
- Question: `TechArticle` with `headline`, `description` (the TL;DR), `inLanguage` en, `author` and `publisher` (the `Person`), `image` (its social card), `mainEntityOfPage`. No dates: `verified` is a month, and Google wants full dates.
- Serialised with `<` escaped as `<`, built by pure functions in `scripts/lib/seo.ts` with tests.

## Real 404
- Prerender `404.html` ("Page not found", `noindex`) through a new catch-all route.
- `vercel.json` rewrites to `/app-shell` only the client-only routes: `/flashcards/:topic`, `/practice/:topic`, `/practice/:topic/:chapter`. Any other unknown path gets Vercel's 404 with `404.html` instead of today's 200 `app-shell`. Checked by `curl` after the next deploy; if it misbehaves, the old catch-all rewrite comes back.

## Social cards and icons
- The card generator (6.3) also makes a site card (home, paths, roadmap, changelog, practice) and a topic card (topic and chapter pages). Same tags as question pages.
- `theme:build` writes `public/favicon.svg` from the palette (R23). The build adds `favicon-32.png` and `apple-touch-icon.png` (180 px) with resvg, and the head links them.

## Sitemap and robots
- Question URLs get `<lastmod>` from `verified` (first of the month). `robots.txt` disallows `/data/`; `/og/` stays crawlable.

## After deploy (maintainer)
Submit the sitemap in Search Console, run the Rich Results Test on one question, `curl -I` an unknown path for a 404.

## Not doing
Hreflang (English only), a feed, Open Graph video, review or FAQ markup (not matching Google's rules for this content).
