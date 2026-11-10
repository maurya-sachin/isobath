---
title: "Where should `\"use client\"` go in a Next.js page, and what does a high boundary cost?"
status: draft
difficulty: medium
frequency: 4
core: false
tags: [rendering, use-client, client-components, bundle-size, hydration, composition]
related:
  - react/server-components/client-boundary
  - react/server-components/rsc-serialization
  - nextjs/rendering/static-or-dynamic-decision
  - nextjs/deployment/next-public-env-inlining
verified: 2026-11
perishable:
  - "Chunk sizes measured with Next.js 16.4.5 Turbopack build"
sources:
  - https://nextjs.org/docs/app/getting-started/server-and-client-components#reducing-js-bundle-size
  - https://nextjs.org/docs/app/getting-started/server-and-client-components#interleaving-server-and-client-components
  - https://nextjs.org/docs/app/getting-started/server-and-client-components#on-the-client-first-load
  - https://nextjs.org/docs/app/getting-started/server-and-client-components#context-providers
  - https://nextjs.org/docs/app/getting-started/server-and-client-components#preventing-environment-poisoning
tldr: >
  On the smallest component that needs state, effects, handlers or browser APIs. The directive marks
  a module boundary: that file and everything it imports ship to the browser and hydrate. Put on a
  page, it ships every library the page renders with and locks out `cookies()`, secrets and direct
  data access. Pass server-rendered UI into client wrappers as `children`.
---

## Answer

In the App Router, pages and layouts are Server Components unless a file says otherwise. `"use client"` at the top of a file marks the **entry** of the client module graph: that file, every module it imports, and the components it renders directly are bundled for the browser. They are still rendered to HTML on the server; the directive adds client JavaScript and hydration, not client-only rendering. Server Components passed in as `children` or other props stay on the server; the client component receives their rendered output.

So the rule is: put `"use client"` on the leaf that needs interactivity (a button with state, a component using `useEffect` or `window`), and keep `page.js` and `layout.js` on the server. When an interactive wrapper must surround server UI (a modal, a collapsible, a context provider), make the wrapper a Client Component that takes `children`, and render it as deep in the tree as it can go.

A boundary at the top of a page costs:

- **Code.** Every library used only to render (parsers, formatters, syntax highlighters) is downloaded, parsed and executed in the browser.
- **Hydration.** React must hydrate the whole subtree, not just the button.
- **Server access.** The page can't import `next/headers`, read secrets or query a database directly; data has to arrive as serializable props or through client fetching.

A boundary at the top is not an SEO cost: the HTML is still server-rendered. Nor is it always more bytes: rendered server output travels in the RSC payload, which can be larger than the data it came from (see Follow-ups).

## Example

```jsx
// app/lib/LikeButton.jsx
'use client';
import { useState } from 'react';

export function LikeButton() {
  const [likes, setLikes] = useState(0);
  return <button onClick={() => setLikes(likes + 1)}>Like ({likes})</button>;
}

// app/lib/Catalog.jsx
import yaml from 'js-yaml';
import { catalogYaml } from './catalog.yaml.js';

export function Catalog() {
  const items = yaml.load(catalogYaml);
  return <ul>{items.map((p) => <li key={p.title}><b>{p.title}</b> {p.body}</li>)}</ul>;
}

// app/low/page.jsx
// app/high/page.jsx is identical with 'use client' as its first line
import { Catalog } from '../lib/Catalog';
import { LikeButton } from '../lib/LikeButton';

export default function Page() {
  return <main><h1>Catalog</h1><LikeButton /><Catalog /></main>;
}
```

Next.js 16.4.5 (Turbopack), `next start`; both routes built as ○. `/low` loaded 7 scripts, 174,752 B gzip, and its only page-specific chunk was the 303-byte `LikeButton`. `/high` loaded an 8th chunk, 47,274 B (14,593 B gzip), containing js-yaml. Both worked in Chrome 156 and Firefox 159.

## Pitfalls

- Marking the page `"use client"` to add one `onClick`. The whole import graph follows it into the bundle.
- Reading `"use client"` as "rendered in the browser". `/high` was still prerendered, with all 40 list items in its HTML.
- Importing server-only code below a boundary. In 16.4.5 a client page importing `cookies` failed the build: `You're importing a module that depends on "next/headers" into a React Client Component module.` Plain secrets fail silently instead (non-`NEXT_PUBLIC_` variables become empty strings); import `server-only` to turn that into a build error.
- Adding the directive to every client-side file. Only entry points need it; everything they import is already client code.

## Follow-ups

**Q:** Is a high boundary always more bytes?
**A:** No. With 1,500 items of plain data instead of js-yaml, `/high` shipped a 9,412 B gzip data chunk, but `/low`'s HTML grew to 498 KB (26 KB gzip) carrying rendered output twice, HTML plus inlined RSC payload. Code and hydration are the dependable costs.

**Q:** How do you add a collapsible around server-rendered content?
**A:** A `'use client'` `Collapsible` that renders `{open && children}`, used as `<Collapsible><Catalog /></Collapsible>` in the server page. That `/slot` route added 240 bytes of uncompressed JavaScript over `/low`; js-yaml stayed on the server.

**Q:** Where should a theme provider go?
**A:** In a `'use client'` provider file that takes `children`, rendered around `{children}` in the layout, not around `<html>`. The docs advise placing providers as deep as possible.
