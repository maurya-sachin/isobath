# Suggest a fix from selected text

Approved and built 2026-11-08 with the maintainer's choices: the bar for every pointer type, the quote as a literal code block, the edit link kept on every page. Mockup: `mockups/suggest-fix.html`. Where the build differs from the first draft, the reason is given; each change removes a part that could not be verified or could break.

## Problem
- "Suggest a fix" opens `correction.yml` with the question id, title and page address filled in, but the reader still has to find and retype the wrong sentence. In issue #7 the reporter retyped two quotes of about 120 characters each.
- "Edit on GitHub" promises an edit. Anyone without write access is asked to sign in and fork, and ends up opening a pull request. The label should say so.

## Behaviour
- **Selecting text.** When the reader selects text inside the question body, a bar appears at the bottom of the viewport. It shows the start of the quote (clamped to 2 lines), the section ("Answer", "Pitfalls"), the character count, a "Suggest a fix for this text" link and a "Clear" button. The bar is centred and no wider than the 720px prose column.
- **Footer.** The footer link follows the same state. With no quote it is the current "Suggest a fix" link. With a quote it reads "Suggest a fix for the selected text" and shows the full quote above the link, with the section, the count and Clear. Both controls are plain `<a href>` links to the same URL, so middle-click and "copy link" work. Nothing opens with `window.open`.
- **What the reader sees before sending.** The selection stays highlighted on the page. The bar shows the start of the quote and the count, and the footer shows the full quote. GitHub's form then shows every field, editable, and nothing is stored until the reader presses Submit there. The site sends nothing itself: it only builds a github.com URL that the reader chooses to open.
- **Edit link.** "Edit on GitHub" becomes "Propose an edit as a pull request". It comes second and in muted text: a correction issue is the main path for readers, and a pull request is for contributors. One line under both links: "Both open GitHub in a new tab and need a GitHub account. Nothing is sent until you submit there."
- **Bar position.** I chose a bar fixed to the bottom over a chip floating next to the selection, for every pointer type:
  - iOS and Android draw their own selection menus next to the selection, usually above it, so a chip there would collide with them.
  - A fixed bar needs no `getBoundingClientRect` and no scroll or resize listeners.
  - It never covers the selected text while that text is being dragged.
  - Cost: on desktop the control sits further from the mouse.

### What goes into the URL
Query parameters are the form's field ids ([form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)). Checked by hand on 2026-11-08 against the live form: an input and a textarea are pre-filled, and a textarea keeps newlines and indentation.

| Param | Value |
|---|---|
| `template` | `correction.yml` (unchanged) |
| `title` | `Fix: <question title>` (unchanged) |
| `question` | question id (unchanged) |
| `page` | page URL, plus `#<section id>` when a quote is held |
| `section` | **new** input: the heading of the section the selection starts in |
| `quote` | **new** textarea: the quote inside a Markdown code fence |

- **Quote.** The reader's selection (`Selection.toString()`) with leading and trailing whitespace trimmed. Inner newlines and code indentation are kept.
- **Fence.** The site wraps the quote in a ```` ```text ```` fence longer than any run of backticks inside it, so `<Fragment key={id}>` and code arrive literally. (Changed from `render: text`: whether a `render` field accepts a pre-fill could not be checked before the template is on `main`; a plain textarea was checked.)
- **500-character cap.** Counted in code points (`Array.from`), so a cut never splits a surrogate pair. A longer quote is cut at 500, ` […]` is appended, and the bar and the footer say "shortened to the first 500". 500 worst-case code points percent-encode to about 6,000 characters, under the 8,000 octets [RFC 9110 §4.1](https://www.rfc-editor.org/rfc/rfc9110#section-4.1) asks servers to support; a unit test holds the longest URL under 8,000.
- **No text directive.** The first draft added `:~:text=` to the page link. Dropped: the section anchor and the quote already locate the problem, and the directive needs encoding rules that differ by browser.

### correction.yml
- After `page`: a `section` input and a `quote` textarea (label "Quoted text"), both filled in by the site.
- `problem` keeps its id. Its description becomes "Say what is wrong and what it should be. If the quoted text is empty, quote the sentence here."

## Selection rules
A quote is taken only when every rule holds; otherwise the event is ignored and any held quote stays.
1. The selection is not collapsed, and its trimmed text is not empty. Whitespace-only selections are ignored.
2. Both ends are inside the question body: `QuestionPage` wraps `QuestionBody` in `<div data-quotable>`. A rule on the ends rejects a select-all, and selections that reach the nav, header, comments or previous/next links. Giscus is in a cross-origin iframe and can't be selected into anyway. For several ranges (Firefox allows Ctrl-click and table-cell selections, per [MDN `rangeCount`](https://developer.mozilla.org/en-US/docs/Web/API/Selection/rangeCount)), the checks use the start of the first range and the end of the last.
3. The start is inside a `section[aria-labelledby]`. That section's `h2` gives the section name and the link anchor (h3 sub-headings are not named). All body content (TL;DR, Answer, Example, Pitfalls, Follow-ups, Deep dive, Exercises) sits in one, and the meta row does not, so badge text can't be quoted. A selection may run across sections; it is named after the section where it starts.
4. Code blocks count. Shiki's line spans sit in one `<pre>`, so the text keeps its newlines and indentation, and the fence preserves them.

**Clearing.** The held quote clears when:
- the reader presses Clear, or Escape while focus is in the bar or the footer panel;
- a click or tap inside the question body collapses the selection (a collapsed `selectionchange` whose caret is inside `[data-quotable]`);
- the reader moves to another question (the component is keyed by question id).

A selection that collapses outside the body does not clear it, so the quote survives the click on the bar's own link on every engine. This holds whether or not that click moves the selection, so no mousedown `preventDefault` is needed.

**Settling.** `selectionchange` fires continuously while a selection is dragged, so the handler reads the selection after it has been still for 300 ms (one `setTimeout`, reset on each event). That spares React a re-render on every mouse move and the screen reader an announcement for each one.

## Wiring
- `app/src/lib/quote.ts` (new, pure, no DOM): `toQuote(selected)` returns `{ text, length, truncated }` or `null`; `fenced(text)`. `MAX_QUOTE = 500`.
- `app/src/lib/repo.ts`: `suggestFixUrl(questionId, title, pageUrl, quote?)` takes `quote?: { text, section, sectionId }`. Without a quote the URL is the same as today. Its file comment renames the edit link.
- `app/src/components/question/SuggestFix.tsx` (new): one `useHeldQuote()` effect (`document.addEventListener('selectionchange')` with the 300 ms settle, `window.getSelection()`, and `closest()` for rules 2 and 3), plus the footer link, the footer panel, the bar and a live region. The live region (`role="status"`, visually hidden) is rendered empty on the server and stays mounted, so screen readers pick up changes. It says "Suggest a fix: 110 characters selected in Answer." once per settled quote, and "Quote cleared." on Clear.
- `app/src/pages/QuestionPage.tsx`: wrap the body in `<div data-quotable>`, put `<SuggestFix key={content.id} … />` in `QuestionFooter` in place of the plain link, and relabel the edit link.
- `app/src/content/types.ts`: comment on `sourcePath` follows the new label.
- `.github/ISSUE_TEMPLATE/correction.yml` as above.
- `app/scripts/lib/quote.test.ts` (new), node:test like the other `scripts/lib` tests.

R19: nothing touches `window`, `document` or `getSelection` at import or during render. The listener is attached in an effect, and the held quote starts as `null`, so the server HTML is today's footer exactly. Every function stays at complexity ≤ 8; the selection check is one function returning the quote or `null`, with the rules above as early returns.

## Accessibility
- **Keyboard.** Nothing floats over the text, and focus is never moved. Readers who select text with caret browsing (F7 in Chrome and Firefox) or with screen reader selection commands get the polite announcement and reach the footer link and panel in normal tab order. Without a selection, the footer link works as it does today.
  - The bar is in the DOM after the footer, so Tab reaches it and leaves it normally.
  - Escape or Clear in the bar or the panel clears the quote and moves focus to the footer link, since the bar disappears. The move uses `preventScroll`: without it, Clear in the bar jumped the page to the footer (found in the browser check).
  - The footer panel's quote has no inner scroll: a scrolling region must be keyboard-focusable (axe `scrollable-region-focusable` failed at 375px), and 500 characters stay short.
- **Target size.** Footer links get `min-h-6` (24px); bar controls are 40px tall.
- **Contrast.** Numbers are from `contrastRatio` in `src/theme/oklch.ts`, at the default hue and the minimum over all six hue presets:
  - Light: link on card 6.79 (min 6.10); muted text on card 6.49 (6.39); muted text on the quote's muted surface 5.74 (5.67); bar border (`--input`) on background 3.78 (3.75).
  - Dark: link on card 8.27 (7.94); muted text on card 7.22 (7.16); muted on muted 6.54 (6.51); bar border on background 4.11 (4.06).
  - `--border` (1.34) is not enough for the bar's edge, so the bar uses `--input`. The focus ring is `--ring` (= link).
- **Large text.** At 145%, the bar wraps its actions under the quote, the quote stays clamped to 2 lines, and the bar's height is capped at 40vh.
- **Other.** `print:hidden` on the bar. No animation, so no reduced-motion case.
- iOS and Android draw their selection menus next to the selection; the bar sits at the opposite edge and pads by `env(safe-area-inset-bottom)`. If a selection on the last visible line opens a menu below itself, the two may overlap. Untested on devices.

## Not doing
- A chip floating next to the selection, or any positioning code.
- Sending anything from the site: no API, no `fetch`, no telemetry, no GitHub token.
- Quoting from the title, meta row, nav, comments or another page; clipping a partly-outside selection to the body (it's ignored instead).
- An in-page form or an editor for the quote: GitHub's form is the editor.
- Ids on h3 headings, or a text directive, for deeper anchors: the quote already shows the exact spot.
- Any change to giscus or the comments section.

## Result (built 2026-11-08)
- Unit tests: `quote.test.ts`, 8 cases, including today's URL unchanged without a quote.
- A scripted run of the production build in Chrome and Firefox (puppeteer, throwaway script): server HTML unchanged; a paragraph and a code block quoted with section, fence and anchor; announcement text; Clear removes the selection and does not scroll; select-all, nav-to-body, body-to-footer and footer-only selections ignored; real mouse drag selects; a click on the bar keeps the quote and a click in the body clears it; Escape returns focus; a long selection is cut and marked; moving to the next question drops the quote; no console errors. With the bar shown, at 375, 768, 1024 and 1440 px, light and dark, 100% and 145% text: no horizontal overflow, axe clean, bar at most 40% of the viewport height. 35 of 35 checks in each browser. `npm run smoke` passes in both.
- Not tested: Safari, real iOS and Android selection menus, screen readers (6A T5).
