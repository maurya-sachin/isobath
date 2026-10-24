# Weekly source link check (PLAN 6.11)

Every question lists primary `sources` in its frontmatter; a dead link silently breaks the claim behind it. A weekly job checks them and opens one issue with the dead ones.

## Behaviour
- `npm run sources:list` (new, in `app/`) prints every distinct page cited in `sources`, fragments removed, one per line, using the same content loader as `content:check`. lychee reads that file, so it never has to parse frontmatter itself.
- A GitHub Actions workflow runs weekly (cron) and on manual dispatch: install Node, `sources:list > urls.txt`, run lychee on it, and if it finds errors open or update a single issue titled "Dead source links" with the report.
- lychee options: `--max-retries 3`, `--timeout 30`, `--accept '200..=299, 429'` (a rate limit is not a dead link), `--no-progress`. Body URLs are not checked: most are strings inside example code. Fragments are not checked either; the page must resolve.
- No exclusion file until a site blocks the check; then a `lychee.toml` entry with a reason.

## Wiring
- `.github/workflows/links.yml` uses `lycheeverse/lychee-action@v2` (inputs `args`, `format`, `output`, `fail`, output `exit_code`) and `peter-evans/create-issue-from-file@v6` (inputs `issue-number`, `title`, `content-filepath`, `labels`), checked against each action's README and `action.yml` on 2026-11-08. The issue number of an open "Dead source links" issue is passed in, so reruns update it instead of opening another. Label: `documentation` (no new label created).
- No change to `ci.yml`: network checks stay out of pull requests so a third-party outage cannot block a merge.

## Not doing
- Auto-fixing or replacing links; a maintainer decides.
- Checking the `verified` date or source content, only that the URL resolves.

## Verification
- Unit test for `sources:list` (dedupe, both locations). Run the workflow once by manual dispatch and read the issue it opens.
