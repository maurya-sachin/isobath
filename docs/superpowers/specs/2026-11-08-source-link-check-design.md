# Weekly source link check (PLAN 6.11)

Every question lists primary `sources` in its frontmatter; a dead link silently breaks the claim behind it. A weekly job checks them and opens one issue with the dead ones.

## Behaviour
- `npm run sources:list` (new, in `app/`) prints every distinct `sources` URL plus the URLs in question bodies, one per line, using the same content loader as `content:check`. lychee reads that file, so it never has to parse frontmatter itself.
- A GitHub Actions workflow runs weekly (cron) and on manual dispatch: install Node, `sources:list > urls.txt`, run lychee on it, and if it finds errors open or update a single issue titled "Dead source links" with the report.
- lychee options: `--max-retries`, `--timeout`, `--accept 200,429` (rate limits are not failures), `--exclude-loopback`. Redirects are reported as warnings in the issue, not failures.
- Exclusions go in a checked-in `lychee.toml` with a reason per entry (sites that block bots).

## Wiring
- Uses `lycheeverse/lychee-action` and an issue action, both pinned to the exact versions whose documented inputs I read when building; the spec's job is the shape, not the flags.
- No change to `ci.yml`: network checks stay out of pull requests so a third-party outage cannot block a merge.

## Not doing
- Auto-fixing or replacing links; a maintainer decides.
- Checking the `verified` date or source content, only that the URL resolves.

## Verification
- Unit test for `sources:list` (dedupe, both locations). Run the workflow once by manual dispatch and read the issue it opens.
