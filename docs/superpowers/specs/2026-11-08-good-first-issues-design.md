# Good-first-issue script (PLAN 6.16)

Contributors find work through issues. The repo has no planned stubs now and 5 `→ —` coverage gaps (all in `javascript`), so the first run opens at most five issues. The script exists so new topics get issues without hand-filing.

## Behaviour
- `npm run issues:plan` (new, in `app/`) is a dry run: lists one candidate per `planned` stub and per `→ —` gap, with title, topic/chapter and file or README line. It writes nothing.
- `npm run issues:open` creates the issues with `gh issue create`, labels `good first issue` and `help wanted`, body from the `new-question` template fields (topic, chapter, difficulty, link to the README line). It first lists open issues and skips any whose title already exists, so reruns are safe.
- The title is generated from the question title or the gap text: `Write: <title>` or `Cover: <sub-topic>`.
- Opening issues is outward-facing: it only runs on an explicit command by the maintainer, never in CI.

## Not doing
- Issues for **Not yet mapped** areas (28 topics): those need a chapter plan first, not a contributor.
- Closing issues when a stub is written; the pull request does that with `Closes #n`.
- A scheduled run.

## Result (built 2026-11-08)
- `issues:plan` on the current repo lists the 5 gaps: Decorators, Error stack accessor, Import defer, ShadowRealm, Legacy RegExp statics. All are TC39 proposals not yet shipped, left as gaps on purpose, so they are not good first issues and `issues:open` has not been run. It becomes useful when a chapter has `planned` stubs.

## Verification
- Unit tests on the candidate list from fixture READMEs (stub, gap, none) and the duplicate-title skip. A real run of `issues:plan` against the repo, checked by hand, before `issues:open` ever runs.
