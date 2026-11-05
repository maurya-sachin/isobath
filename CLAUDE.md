# isobath

Interview questions for any software engineer, from language to spec/engine to infrastructure — not introductory.
One Markdown file per question in `content/`; the client-only app in `app/` reads generated JSON.

## Every session
1. Read `PLAN.md` → **Now**. Its rules are settled. If it names work an agent was still doing at handoff, verify those commits (`git log`, `content:check`) before starting anything new.
2. Work one phase task or one chapter. New design work gets an approved spec in `docs/superpowers/specs/` before any product code.
3. Before ending, apply Plan hygiene.

## Plan hygiene (tracker)
- `PLAN.md` holds only open work and rules that still guide work.
- Task finished → delete its line (git history keeps it). Phase finished → delete its section.
- Rule no longer guiding anything → delete it. New settled decision → add one short rule line.
- Rewrite **Now** (branch, doing, next, open questions) in ≤ 5 lines.
- No narration, session logs, rationale paragraphs, or dates a task doesn't need.
- Per-question progress lives in README status lines and `content:status`, never in `PLAN.md`.
- Same applies to `.claude/notes/style.md`: remove anything outdated.
- Ground rule, every session and every plan: trim the agent-facing docs of this repo as part of normal work. Whenever you read or edit `CLAUDE.md`, `PLAN.md`, `.claude/notes/style.md` or the memory index, and before ending any session, delete outdated, duplicated, narrative or unrelated lines; keep only what still guides work. Not README, templates or specs.

## Token rules
- Never bulk-read `content/`, `app/public/data/`, or `app/dist/`. Find through READMEs, script output, or a title grep; open one file.
- v1 lives only on tags `v1-archive` (source) and `v1-site-archive` (built site) — never read it or reuse its text.
- Validate with `content:check` (in `app/`); don't re-read files you just wrote.

## Working rules
- Work on branch `dev`, cut from `main`. Commit after every finished task, one concern each (deletion, docs, dependency, feature, one question or chapter), with conventional messages (`feat:`, `docs:`, `content:`, `chore:`).
- Merge `dev` into `main` with a merge commit (PR or local `--no-ff`) — never squash (GitHub's heatmap counts only commits on `main`). `main` deploys to production.
- Any push (even `dev`), deploy, DNS change or `published` needs the maintainer's OK each time.
- Code ground rule: solid senior-level solutions, no jugaad, no over-engineering. Keep functions at cyclomatic complexity ≤ 8 (ESLint `complexity` fails above 10). Reduce it by splitting into named steps (one function per rule, section or case), not by adding layers, tables or abstractions that hide the branches. A function that truly needs more carries a one-line `eslint-disable` with the reason. Touching a function above the limit means fixing it in the same area, as its own commit.
- Content follows `templates/README.md`; write it with the `write-question` skill (Batch mode for chapters and flashcards).
