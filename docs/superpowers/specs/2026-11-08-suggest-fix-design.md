# Suggest a fix from selected text

Direction approved by the maintainer 2026-11-08; this spec waits for approval of the details below. Mockup: `mockups/suggest-fix.html`.

## Problem
- "Suggest a fix" opens `correction.yml` with the question id, title and page address filled in, but the reader still has to find and retype the wrong sentence. In issue #7 the reporter retyped two quotes of about 120 characters each.
- "Edit on GitHub" promises an edit. Anyone without write access is asked to sign in and fork, and ends up opening a pull request. The label should say so.

## Behaviour
- **Selecting text.** When the reader selects text inside the question body, a bar appears at the bottom of the viewport. It shows the start of the quote (clamped to 2 lines), the section ("Answer", "Pitfalls › Stale closures"), the character count, a "Suggest a fix for this text" link and a "Clear" button. The bar is centred and no wider than the 720px prose column.
- **Footer.** The footer link follows the same state. With no quote it is the current "Suggest a fix" link. With a quote it reads "Suggest a fix for the selected text" and shows the full quote above the link, with the section, the count and Clear. Both controls are plain `<a href>` links to the same URL, so middle-click and "copy link" work. Nothing opens with `window.open`.
- **What the reader sees before sending.** The selection stays highlighted on the page. The bar shows the start of the quote and the count, and the footer shows the full quote. GitHub's form then shows every field, editable, and nothing is stored until the reader presses Submit there. The site sends nothing itself: it only builds a github.com URL that the reader chooses to open.
- **Edit link.** "Edit on GitHub" becomes "Propose an edit as a pull request". It comes second and in muted text: a correction issue is the main path for readers, and a pull request is for contributors. One line under both links: "Both open GitHub in a new tab and need a GitHub account. Nothing is sent until you submit there."
- **Bar position.** I chose a bar fixed to the bottom over a chip floating next to the selection, for every pointer type:
  - iOS and Android draw their own selection menus next to the selection, usually above it, so a chip there would collide with them.
  - A fixed bar needs no `getBoundingClientRect` and no scroll or resize listeners.
  - It never covers the selected text while that text is being dragged.
  - Cost: on desktop the control sits further from the mouse.

### What goes into the URL
Query parameters are the form's field ids. GitHub fills custom issue-form fields from URL query parameters ([creating an issue from a URL query](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue#creating-an-issue-from-a-url-query)), and a field's `id` "is the canonical identifier for the field in URL query parameter prefills" ([form schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema)).

| Param | Value |
|---|---|
| `template` | `correction.yml` (unchanged) |
| `title` | `Fix: <question title>` (unchanged) |
| `question` | question id (unchanged) |
| `page` | page URL + `#<section id>` + `:~:text=<directive>` when a quote is held |
| `section` | **new** input: the h2 title, plus ` › <h3 text>` when an h3 precedes the start of the selection in that section |
| `quote` | **new** textarea: the quote |

- **Quote.** The reader's selection (`Selection.toString()`) with leading and trailing whitespace trimmed. Nothing else changes: inner newlines and code indentation are kept.
- **500-character cap.** The cap counts code points (`Array.from`), so a cut never splits an emoji. A longer quote is cut at 500, ` […]` is appended, and both the bar and the footer say "Shortened to the first 500 of 690 characters".
  - Why 500: GitHub documents no length limit, only a `414 URI Too Long` page past "the server limit". [RFC 9110 §4.1](https://www.rfc-editor.org/rfc/rfc9110#section-4.1) recommends supporting URIs of at least 8000 octets. In the worst case a code point percent-encodes to 12 characters, so 500 code points come to 6,018 characters. The rest of the URL (title, id, page and directive) stays under 2,000, which keeps the URL under 8,000.
  - The quote is there to locate the problem, not to carry the argument: 500 is four times the quotes in #7.
  - The real sample in the mockup gives 512 characters for a 110-character quote and 929 for a truncated one.
- **Text directive.** The directive links to the exact spot ([MDN text fragments](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments)). It is built from the untruncated selection, so a cut word never breaks the match.
  - Shape: the first 4 words of the first line and the last 4 words of the last line (`textStart,textEnd`). A one-line quote of 8 words or fewer is used whole.
  - Each part is encoded with `encodeURIComponent` and `-` → `%2D`, as MDN requires.
  - MDN: each part must sit inside one block element, but the match may span blocks. The first and last lines satisfy this, because `toString()` puts newlines between blocks.
  - If the encoded directive is over 300 characters (very long "words", such as a minified line), it is dropped and the link keeps only `#<section id>`.
  - MDN: when nothing matches, or a browser lacks support, the directive is ignored. Support starts at Chrome 80, Firefox 131 and Safari 16.1 (MDN browser-compat-data `html.elements.a.text_fragments`).
  - Prerendered pages contain the text at load, so the browser can match it.

### correction.yml
- After `page`, add a `section` input (label "Section"; description "Filled in when you select text on the page and use Suggest a fix.").
- After `section`, add a `quote` textarea (label "Quoted text", `render: text`). The form schema says `render` formats the submitted text "into a codeblock", so text like `<Fragment key={id}>` arrives literally and code keeps its indentation instead of being read as Markdown or HTML. The cost: long prose lines scroll sideways in the issue.
- `problem` keeps its id. Its description becomes "Say what is wrong and what it should be. If the quote field is empty, quote the sentence here."

## Selection rules
A quote is taken only when every rule holds; otherwise the event is ignored and any held quote stays.
1. The selection is not collapsed, and its trimmed text is not empty. Whitespace-only selections are ignored.
2. Both ends are inside the question body: `QuestionPage` wraps `QuestionBody` in `<div data-quotable>`. A rule on the ends rejects a select-all, and selections that reach the nav, header, comments or previous/next links. Giscus is in a cross-origin iframe and can't be selected into anyway. For several ranges (Firefox allows Ctrl-click and table-cell selections, per [MDN `rangeCount`](https://developer.mozilla.org/en-US/docs/Web/API/Selection/rangeCount)), the checks use the start of the first range and the end of the last.
3. The start is inside a `section[aria-labelledby]`. That section's `h2` gives the section name and the link anchor. All body content (TL;DR, Answer, Example, Pitfalls, Follow-ups, Deep dive, Exercises) sits in one, and the meta row does not, so badge text can't be quoted. A selection may run across sections; it is named after the section where it starts.
4. Code blocks count. Shiki's line spans sit in one `<pre>`, so the text keeps its newlines and indentation, and the `render: text` field preserves them.

**Clearing.** The held quote clears when:
- the reader presses Clear, or Escape while focus is in the bar or the footer panel;
- a click or tap inside the question body collapses the selection (a collapsed `selectionchange` whose caret is inside `[data-quotable]`);
- the reader moves to another question (the component is keyed by question id).

A selection that collapses outside the body does not clear it, so the quote survives the click on the bar's own link on every engine. This holds whether or not that click moves the selection, so no mousedown `preventDefault` is needed.

**Settling.** `selectionchange` fires continuously while a selection is dragged, so the handler reads the selection after it has been still for 300 ms (one `setTimeout`, reset on each event). That spares React a re-render on every mouse move and the screen reader an announcement for each one.

## Wiring
- `app/src/lib/quote.ts` (new, pure, no DOM): `toQuote(raw)` returns `{ text, length, truncated }`; `textDirective(raw)` returns a string or `''`. `MAX_QUOTE = 500`.
- `app/src/lib/repo.ts`: `suggestFixUrl(questionId, title, pageUrl, quote?)` takes `quote?: { text, section, sectionId, directive }`. Without a quote the URL is the same as today. Its file comment renames the edit link.
- `app/src/components/question/SuggestFix.tsx` (new): one `useHeldQuote()` effect (`document.addEventListener('selectionchange')` with the 300 ms settle, `window.getSelection()`, and `closest()` for rules 2 and 3), plus the footer link, the footer panel, the bar and a live region. The live region (`role="status"`, visually hidden) is rendered empty on the server and stays mounted, so screen readers pick up changes. It says "Suggest a fix: 110 characters selected in Answer." once per settled quote, and "Quote cleared." on Clear.
- `app/src/pages/QuestionPage.tsx`: wrap the body in `<div data-quotable>`, put `<SuggestFix key={content.id} … />` in `QuestionFooter` in place of the plain link, and relabel the edit link.
- `app/src/content/types.ts`: comment on `sourcePath` follows the new label.
- `.github/ISSUE_TEMPLATE/correction.yml` as above.
- `app/scripts/lib/quote.test.ts` (new), node:test like the other `scripts/lib` tests.

R19: nothing touches `window`, `document` or `getSelection` at import or during render. The listener is attached in an effect, and the held quote starts as `null`, so the server HTML is today's footer exactly. Every function stays at complexity ≤ 8; the selection check is one function returning the quote or `null`, with the rules above as early returns.

## Accessibility
- **Keyboard.** Nothing floats over the text, and focus is never moved. Readers who select text with caret browsing (F7 in Chrome and Firefox) or with screen reader selection commands get the polite announcement and reach the footer link and panel in normal tab order. Without a selection, the footer link works as it does today.
  - The bar is in the DOM after the footer, so Tab reaches it and leaves it normally.
  - Escape in the bar or the panel clears the quote and returns focus to the footer link, since the bar disappears.
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
- Ids on h3 headings for deeper anchors: the text directive already points to the exact spot.
- Any change to giscus or the comments section.

## Verification
- **Unit tests** (`quote.test.ts`):
  - trim only, inner newlines kept;
  - 500 kept and 501 truncated with the notice data;
  - emoji at the cut not split;
  - directive for 1 line ≤ 8 words, for multi-line text, and dropped above 300;
  - `-`, `,` and `&` encoded;
  - `suggestFixUrl` with no quote equals today's URL;
  - a 500-emoji quote with a 200-character title stays ≤ 8,000 characters.
- **Browsers.** Production build on the smoke server, this question, Chrome and Firefox (Safari if available), at 375, 768, 1024 and 1440 px, in light and dark, with 145% text. Check:
  - select in Answer: the bar appears and the URL opens a prefilled form on GitHub (checked by hand: does the `render: text` field take the prefill?);
  - select inside the Example code: newlines are kept;
  - Ctrl+A, nav-to-body and body-to-comments selections: no bar;
  - a click in the body clears the quote, and a click on the bar's link does not;
  - over 500 characters: the notice is shown;
  - the `page` link scrolls to and highlights the quote in Chrome and Firefox, and lands on the section when the directive is dropped;
  - keyboard-only with caret browsing: the announcement plays and the footer panel is reachable;
  - axe clean, no console errors, no horizontal overflow.
- Not testable here: real iOS and Android selection menus, and screen readers. Listed for the maintainer's 6A T5 pass.

## Open questions
1. Bar for every pointer type, as specified, or footer only on desktop with the bar only on touch?
2. `render: text` for the quote (literal, code-safe, long lines scroll), or a Markdown field (wraps, but `<Tag>` text can be mangled)?
3. Keep "Propose an edit as a pull request" on every question page, or move it to the contributor guide and keep only Suggest a fix on the page?
