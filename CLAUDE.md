# isobath

Interview questions for any software engineer, from language to spec/engine to infrastructure — not introductory.
One Markdown file per question in `content/`; the client-only app in `app/` reads generated JSON.

## Every session
1. Read `PLAN.md` → **Now**. Its rules are settled. If it names work an agent was still doing at handoff, verify those commits (`git log`, `content:check`) before starting anything new.
2. Work one phase task or one chapter. New design work gets an approved spec in `docs/superpowers/specs/` before any product code.
3. Before ending, apply Plan hygiene.

## Plan hygiene (tracker)
- `PLAN.md` holds only open work and rules that still guide work; finished tasks and phases are deleted (git keeps them).
- Rewrite **Now** (branch, doing, next, open questions) in ≤ 5 lines.
- Per-question progress lives in README status lines and `content:status`, never in `PLAN.md`.

## Token rules
- Never bulk-read `content/`, `app/public/data/`, or `app/dist/`. Find through READMEs, script output, or a title grep; open one file.
- v1 lives only on tags `v1-archive` (source) and `v1-site-archive` (built site) — never read it or reuse its text.
- Validate with `content:check` (in `app/`); don't re-read files you just wrote.

## Working rules
- Work on branch `dev`, cut from `main`; `main` deploys to production. Commit after every finished task, one concern each (deletion, docs, dependency, feature, one question or chapter), with conventional messages (`feat:`, `docs:`, `content:`, `chore:`).
- Marking questions `published` (a chapter at a time, PLAN R24) needs the maintainer's OK each time.
- Content follows `templates/README.md`; write it with the `write-question` skill (Batch mode for chapters and flashcards).
