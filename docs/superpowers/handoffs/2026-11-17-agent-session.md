# Session handoff — 2026-11-17 (non-Claude agent)

Claude sessions: read this before continuing. Work is on branch `dev`, **not pushed**. This session wrote no
question prose and no topic outlines (R21).

## Commits

| Commit    | What                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `cbf8127` | `05/030 staleTime vs gcTime`: `core: false` → `core: true`              |
| `85619c6` | `PLAN.md` Now without that item                                         |
| `e65b7f4` | `content:scaffold` tool: library, CLI, tests, npm script                |
| `a6b4ae6` | the command in the guide's table                                        |
| `b925124` | the CLI refuses a topic with no README                                 |
| this commit | this handoff and the `PLAN.md` Now update                             |

## Decision needed on `05/030`

The approved spec (`2026-11-12-state-and-data-fetching-topic-design.md`) lists it as `(medium, 5)` **without**
`core`, while `templates/README.md` says "set it on every `frequency: 5` question". This session followed the
template. Either keep `core: true` or change the spec's `frequency` to 4 — the spec and the stub currently
disagree if it stays `core: true` with no spec update.

Revert both commits with `git revert --no-commit cbf8127 85619c6 && git commit -m "revert: 05/030 core tag"`.

## Scaffold tool (new)

- `app/scripts/lib/scaffold.ts` — parses an outline (YAML), validates it (chapter/question numbers and slugs,
  frontmatter via `frontmatterSchema`, `frequency: 5` requires `core`, every question listed under a sub-topic),
  renders chapter READMEs and `planned` stubs, refuses to overwrite, supports a dry run.
- `app/scripts/scaffold.ts` — CLI: `npm run content:scaffold -- <outline.yml> [--dry-run]`. It refuses a topic with
  no README (the scope, track and sources stay hand-written), then syncs READMEs and runs the same checks as
  `content:check`.
- `app/scripts/lib/scaffold.test.ts` — 8 tests: numbering, validation failures, rendering, write-once, dry run.
- Verified: `node --test scripts/lib/scaffold.test.ts`, `npm test` (203 pass), `npm run lint`, `npx tsc -b`, and a
  dry run against a sample outline.

**No outlines were authored.** The outline is still the per-topic spec deliverable (Opus/maintainer); the tool only
executes an approved one. Next topic in order after `nextjs` and `state-and-data-fetching` is `accessibility`.

## Verification done (no content edits)

Built with a fake `VITE_POSTHOG_KEY`, served `dist/` locally, and stubbed `/soundings` so nothing left the machine.
Axe was injected after stripping the page's CSP meta for that one request (it blocks inline scripts).

`/privacy`, Chrome 157 and Firefox 160:

- 375×667, 768×1024, 1024×768, 1440×900, light and dark: no horizontal overflow at 100% and at 145% text; 0 console
  errors; `<title>` present in every run.
- axe-core 4.14.0, WCAG 2.2 A/AA: **0 violations** at 375 and 1440, both themes, both browsers. One `incomplete`
  node (`color-contrast` inside the consent banner because of layered backgrounds); measured manually at 6.47:1
  light and 7.24:1 dark, above 4.5:1.
- Keyboard: Tab reaches the "Don't count my visits" checkbox in both browsers, with a native focus outline
  (Chrome `auto 1px`, Firefox `auto 3px`).
- Prerendered `dist/privacy.html`: `<title>Privacy · isobath</title>`, and `grep "Anonymous analytics"` = 0
  (no banner markup in the HTML).
- Not tested: Safari, real devices, screen readers (still the 6A T5 maintainer task).

Named events, same harness (one practice chapter, one flashcard round):

- Captured: `practice_answer` ×8, `practice_session_finish` ×1 (`knew: 8, missed: 0`), `flashcard_rate` ×20,
  `flashcard_session_finish` ×1 (`rated: 20, round: 1`), `$opt_in` ×1, `$pageview` ×2, `$$heatmap` ×1. No console
  errors.
- Properties arrived as designed (`question_id`, `result`, `topic`, `chapter`, `rating`, `is_new_card`, `rated`,
  `round`, plus the super properties `theme`, `reading_font`, `text_size`).
- Conclusion: the hooks fire; "no events arriving" was not a code bug. What remains is confirming real traffic in
  PostHog.
- Anyone repeating this: headless PostHog treats Puppeteer as a bot because `navigator.webdriver` is true. Set it
  false in the harness (and use a normal UA) or every event is dropped with a debug log line.

## Left untouched

- Cookie-consent plan checkboxes: all still `- [ ]` although the work is merged. Not ticked, because Task 5's real
  Safari/device checks cannot be verified from here.
- `dead-clicks-autocapture.js` blocked by filename: unchanged; the proxy cannot fix a filename-based rule.
- PostHog dashboard/event-properties check, Search Console, Anki, wordmark, screen-reader pass: need maintainer access.
- Browser harness scripts live in the session scratchpad, not the repo (Phase 7 rule).
