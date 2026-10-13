# Printable chapter cheat sheet (PLAN 6.5)

One page per chapter that lists every question with its 30-second answer, laid out to read on screen and to print or save as PDF from the browser.

## Page
- Route `/cheatsheet/:topic/:chapter`, beside `/practice/:topic/:chapter`. It cannot sit under the chapter (`/:topic/:chapter/cheatsheet`): that shape is a question URL, and a question could be named `cheatsheet`.
- Content: the chapter title and summary, then one entry per readable question in chapter order: number, title (links to the question), difficulty, a "core" mark, and the `tldr` with its inline code styled. Questions without a page yet are left out.
- A "Print" button (`window.print()`) and a link back to the chapter. The chapter page gets a "Cheat sheet" button beside "Practice this chapter" when the chapter has readable questions.
- Client-only, like Practice and Flashcards: a Vercel rewrite to `app-shell`. That gives `noindex`, no sitemap entry and no prerender for free; the sheet repeats text that lives on the question pages. `cheatsheet` is a reserved topic slug.

## Data
- The build writes `data/topics/<topic>/<chapter>/cheatsheet.json`: `{ id, tldrHtml }[]`, from the same `tldrHtml` the question pages use. Number, title, difficulty and core come from the topic index the page already has. The page loads it with a route loader (`loadCheatsheet`), as Practice does for its questions.
- A chapter with no readable questions has no file and no page.

## Print
- `@media print`: hide the header, footer, and the page's buttons; black text on white regardless of theme; one column; `break-inside: avoid` per entry; links keep their text and do not print their URLs.
- On screen the sheet uses the normal theme, Appearance settings and a reading width.

## Not doing
- Server-side PDF, a per-topic or whole-site sheet, flashcards on the sheet, or print-specific dark mode.
- Answer, example or pitfalls text: the sheet is the `tldr` only.

## Verification
- Prerender diff shows no change on existing pages. New pages pass `content:check` and axe.
- Print checked with headless Chrome's PDF output (A4): no clipped or split entry, no header, no horizontal overflow. Safari print is a maintainer check.
- While printing the page switches to the light theme and a white page (`usePrintInLight`, a print rule), so dark-theme readers get dark text on white.
- Standard UI gate: 375/768/1024/1440 px, light and dark, keyboard, 145% text.
