# Slim hydration data (PLAN 6.10)

Every prerendered page embeds its route loader data so the browser can hydrate without refetching. Today the root route embeds the whole manifest on every page, and the header uses four fields of it.

## Measured (production build, 2026-11-06)
| Page | HTML | Hydration data | Of which |
|---|---|---|---|
| Question | 149 kB (27 kB gzip) | 104 kB | manifest 44, topic index 25, question 20 |
| Chapter | 99 kB | 78 kB | manifest 44, topic index 25 |
| Home | 149 kB | 49 kB | manifest 44 |

The manifest is 34 kB of topics (summary HTML and text, planned areas, stats, per topic) and 10 kB of role paths. Only Home, Roadmap, Paths, one Path and the Practice hub read more than the header's four fields (`slug`, `title`, `track`, `chapterCount`). PLAN's "131 kB" figure was out of date.

## Change
- The root route's loader returns a site index: `{ topics: { slug, title, track, chapterCount }[] }`, about 2 kB. `TopicSwitcher` reads it through `useSiteIndex()`.
- Home, Roadmap, Paths, a Path and the Practice hub get the full manifest from their own route loader (`loadManifest`, still one shared request). Only those pages embed it.
- Result, measured on the build (average embedded data per page, escaped JSON): question 131 → 85 kB, chapter 101 → 55 kB, other pages 53 → 19 kB. Home grows by 3 kB (49 → 52): it embeds the site index beside the manifest.
- `useManifest()` is removed; its callers use `useLoaderData()` for their route's loader.

## Not doing
- Slimming the topic index (25 kB) to one chapter: the question page needs the whole topic for previous/next across chapters, so a cut means a new shape of data for a smaller gain (about 3 kB gzip). Revisit after measuring this change.
- Dropping hydration data (a client fetch plus `HydrateFallback` over prerendered HTML mismatches and throws React #418, as the lazy-route work showed).
- Changing how `data/*.json` is built or fetched.

## Verification
- A prerender diff shows only the removed manifest data: visible text of every page is identical.
- Each page type hydrates with no console error (Lighthouse best practices 100) and the header's topic menu still lists every topic, planned ones marked.
- Hydration size per page type re-measured and put in the commit message.
