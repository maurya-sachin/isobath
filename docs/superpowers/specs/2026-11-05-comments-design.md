# Comments and reactions (PLAN 6.4)

Giscus: each question's comments are a GitHub Discussion in `maurya-sachin/isobath`, category "Questions" (Announcement format: only maintainers and the giscus bot start threads; any signed-in GitHub user comments and reacts).

## Behaviour
- Question pages end with a "Comments" section after the previous/next links. Chapter, topic and other pages have none.
- Mapping `specific`, term = the question id (`javascript/numbers-and-bigint/floating-point-precision`): one stable discussion per question, unaffected by title edits or URL changes. The bot creates the discussion on the first comment or reaction.
- Reactions on, comment box above the thread, English UI.
- Nothing loads until the reader scrolls near the section: the component is a dynamic import rendered only after hydration, and giscus's own `loading="lazy"` defers its iframe. Server HTML holds the heading and a one-line note that comments use GitHub sign-in, so the first paint is neutral (R19).
- Theme follows the app's: giscus built-in `light` or `dark`, from the stored preference or, for "system", the OS. A custom stylesheet from tokens is not worth it yet: giscus fetches it by absolute URL, so it can't be checked before deploy. Revisit if the built-ins look off next to the page.
- `giscus.json` at the repo root limits embedding to `https://learn.sachinmaurya.com` and the Vite dev server.

## Ids
Repo id `R_kgDOQNTxwg`, category id `DIC_kwDOQNTxws4DKbVV` (read with `gh api graphql`; they are public identifiers). Kept in `src/lib/repo.ts` next to `REPO_URL`.

## Not doing
- Comments on drafts is moot: only pages that exist get the section.
- Moderation tooling, a comment count in lists, or self-hosting giscus.
