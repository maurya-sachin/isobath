---
title: "What do route groups and multiple root layouts change about navigation?"
status: draft
difficulty: medium
frequency: 2
core: false
tags: [app-router, route-groups, root-layout, navigation, full-page-load]
related:
  - nextjs/app-router/app-router-component-tree
  - nextjs/app-router/layout-state-and-template
  - nextjs/navigation/link-click-to-render
verified: 2026-11
perishable:
  - "global-not-found.js is experimental (globalNotFound flag) in Next.js 16.4"
sources:
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-groups#convention
  - https://nextjs.org/docs/app/api-reference/file-conventions/route-groups#caveats
  - https://nextjs.org/docs/app/api-reference/file-conventions/layout#root-layout
  - https://nextjs.org/docs/app/getting-started/project-structure#opting-specific-segments-into-a-layout
  - https://nextjs.org/docs/app/getting-started/project-structure#creating-multiple-root-layouts
  - https://nextjs.org/docs/app/api-reference/file-conventions/not-found#global-not-foundjs-experimental
tldr: >
  A `(group)` folder adds no URL segment, so it only changes which layouts wrap which routes.
  Navigation between routes under the same root layout stays client-side, and a layout inside a
  group persists only between routes in that group. Routes under different root layouts can't share
  a React tree, so `<Link>` between them does a full document load.
---

## Answer

A folder named in parentheses, `app/(shop)/cart/page.js`, is a **route group**: it serves `/cart`, not `/shop/cart`. Groups exist to attach layouts to a subset of routes without changing URLs. Two groups must not resolve to the same path; `(marketing)/about` and `(shop)/about` fail the build.

What a group changes is the **layout tree**, and navigation follows that tree:

- **A layout inside a group** (under a shared root layout) wraps only the group's routes. Moving between two routes in the group keeps it mounted with its state; moving out of the group unmounts it. The navigation is still client-side.
- **Multiple root layouts.** Delete `app/layout.js` and give each group its own layout with `<html>` and `<body>`; each is then a root layout. A root layout owns the document, so the router can't swap one for another inside the same React tree. A `<Link>` from `/cart` (`(shop)`) to `/blog` (`(marketing)`) does a **full page load**: a new document request, the JavaScript state and any client caches gone. Within one root layout, navigation stays soft.

Use multiple root layouts when sections really differ at the document level: separate fonts, global CSS, `<html lang>`, or an admin app that shares nothing with the marketing site. The cost is a full reload whenever users cross between them, so keep sections people move between often under one root.

Without `app/layout.js`, the home page must live in a group (`app/(shop)/page.js`), and there's no single layout for a global 404. The experimental `global-not-found.js` covers that case.

A root layout under a dynamic segment (`app/[lang]/layout.js`) is still one root layout: switching `/en` to `/fr` stayed client-side in testing.

## Example

```jsx
// app/(shop)/layout.jsx: root layout for /, /cart, /account
import Link from 'next/link';
export default function ShopLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Link href="/account">Account</Link> <Link href="/blog">Blog</Link>
        {children}
      </body>
    </html>
  );
}

// app/(marketing)/layout.jsx: root layout for /blog
import Link from 'next/link';
export default function MarketingLayout({ children }) {
  return <html lang="en"><body><Link href="/cart">Cart</Link>{children}</body></html>;
}

// app/(shop)/page.jsx, app/(shop)/cart/page.jsx,
// app/(shop)/account/page.jsx, app/(marketing)/blog/page.jsx
```

Next.js 16.4.5 under `next start`, Chrome 156 and Firefox 159. A marker set on `window` survived `/cart` → `/account` with no document request. `/account` → `/blog` and `/blog` → `/cart` each made a document request and lost the marker.

## Pitfalls

- Splitting an app into root layouts for organisation only. Every crossing reloads the page; use nested group layouts under one root unless the document itself differs.
- Two groups claiming one path. The 16.4.5 build stopped with `You cannot have two parallel pages that resolve to the same path. Please check /(marketing)/about and /(shop).`
- Forgetting the home route. With no `app/layout.js`, `/` must be a page inside one group.
- Expecting a shared header to persist across root layouts. Each root renders its own copy, and crossing remounts it from scratch.

## Follow-ups

**Q:** Does a route group change a page's URL or `params`?
**A:** No. The group name is dropped from the path and never appears in `params`; only the layout nesting changes.

**Q:** How can you tell a navigation was a full load?
**A:** The Network panel shows a document request instead of an RSC fetch, and anything stored on `window` or in React state is gone, which is how the test detected it.

**Q:** What did an unknown URL return with two root layouts and no `not-found.js`?
**A:** `/nope` answered `404` with Next.js's built-in "This page could not be found." page.
