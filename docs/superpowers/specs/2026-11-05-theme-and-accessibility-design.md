# Theme "Chart" and accessibility

Colour and accessibility only: layouts, components and fonts stay as they are.

## Why
Dark mode mixes three darks: a saturated navy (page, cards, TL;DR), a neutral purple-grey (sidebar tokens) and GitHub's grey-blue (code). Colour is also defined in several places (`index.css`, `og` card hex, Shiki themes). The reader should get a calm, quietly motivating page, with every colour coming from one hue.

## Look
- One hue (default 265, the blue-indigo of the current brand) drives every colour in both modes. Neutrals are that hue at very low chroma; one accent; no second accent. The depth ramp is one hue stepping by lightness, so it is colour-blind-safe by design. Depth contours are the only decorative colour.
- Light: cool off-white page, white cards, near-black (not black) text. Dark: deep tinted ink, surfaces lifted by lightness steps with solid tinted borders, softened off-white text. Code blocks sit one step below the page in the same hue.
- Steps (OKLCH lightness / chroma; hue from the setting):

| Token | Light | Dark |
|---|---|---|
| background | .985 / .004 | .17 / .02 |
| card, popover | .997 / .002 | .205 / .022 |
| muted, secondary, accent | .955 / .01 | .245 / .025 |
| border | .90 / .014 | .31 / .03 |
| foreground | .24 / .03 | .935 / .01 |
| muted-foreground | .48 / .03 | .72 / .03 |
| link, ring | .48 / .19 | .76 / .12 |
| TL;DR surface / text | .955 / .03 · .32 / .09 | .235 / .045 · .87 / .05 |
| code surface | .965 / .008 | .145 / .02 |
| depth 1 → 4 | .60 .51 .42 .33 (c .14 .15 .14 .12) | .82 .73 .64 .56 (c .09 .12 .14 .15) |

These pass WCAG 2.2 AA at every hue (checked 0–360 in 5° steps): text 4.5:1, ramp ends and links 3:1/4.5:1. A test keeps them honest.

## One source
- `src/theme/palette.ts` holds the table above and the OKLCH → sRGB maths. `npm run theme:build` (run by `dev`, `build`, `test`) writes `src/theme/palette.css` (generated, git-ignored, R3): every token as `oklch(L C var(--hue))`, with `:root { --hue: var(--hue-light, 265) }` and `.dark { --hue: var(--hue-dark, 265) }`.
- Everything reads those tokens: the Tailwind/shadcn tokens in `index.css`, Shiki (one `css-variables` theme replaces `github-light`/`github-dark`, so code follows the hue and mode with no `!important` overrides), the output-line highlight (today a hard-coded green), and the social card (imports the palette, converts to hex).
- Destructive keeps its own fixed red hue and does not follow the setting.

## Appearance setting
- A panel beside the theme toggle: accent hue per mode (six presets: Indigo 265, Sky 235, Teal 190, Green 150, Violet 300, Rose 355; or any hue; "same for both" on by default), text size 100 / 120 / 145 %, contrast standard / high, motion follows system / reduce, Reset.
- Users choose a hue only; lightness is fixed by the palette, so any pick passes contrast.
- Stored in `localStorage` key `appearance` (JSON; absent = defaults). The inline script in `index.html` applies it before first paint (`--hue-light`, `--hue-dark`, `--text-scale`, `data-contrast`, `data-motion`), as it does for the theme today. Nothing touches storage at import time (R19); the panel renders neutral until hydrated.
- High contrast also follows `prefers-contrast: more`; reduced motion follows `prefers-reduced-motion: reduce`; both have the in-app override.

## Accessibility
1. Contrast: AA everywhere; high-contrast option raises text, border and focus steps; `forced-colors` shows borders and focus rings.
2. Text size: all type in `rem`; usable at 200 % zoom and 320 px wide; survives WCAG text-spacing overrides.
3. Colour-blind: colour is never the only cue (existing shapes stay; status gets an icon or text); a test checks the ramp's lightness steps stay distinguishable under protanopia, deuteranopia and tritanopia.
4. Keyboard and screen readers: focus ring ≥ 3:1, targets ≥ 24 px, skip link, scrollable code blocks focusable, names on custom controls.
5. Audit: axe-core over key pages in the browser check; findings fixed or recorded.

## Not doing
Layout or font changes; a second accent; per-user lightness or chroma; a dyslexia font; syncing settings across devices; a custom giscus theme (after deploy, from the palette).

## Order
T1 palette source + generated CSS + contrast test, replacing token values. T2 Shiki, output highlight, social card on the palette. T3 verify in the browser (both modes, three widths, no-drafts build). T4 Appearance panel and pre-paint script. T5 accessibility audit and fixes. T6 giscus theme from the palette.
