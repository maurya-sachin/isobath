# Security headers and CSP (PLAN Q3)

The site is static, has no accounts and stores nothing server-side, so the aim is small: stop it being framed, stop MIME sniffing, limit what a script that did get in could load, and keep third-party code to the one thing it needs (giscus comments).

## What a page contains (production build, 2026-11-06)
- Inline scripts: the theme and Appearance script (1.3 kB, identical on every page, runs before paint) and, on prerendered pages, the router's hydration data (50–58 kB, different on every page). JSON-LD blocks are data, not executed, so CSP does not cover them.
- External script: the app bundle, same origin; `@giscus/react` adds `https://giscus.app/client.js` and an iframe from `giscus.app` on question pages.
- Styles: no `<style>` in the HTML, but 18–132 inline `style` attributes per page, and Radix (`react-remove-scroll`) adds `<style>` elements at runtime.
- Fonts, data JSON and images are same origin. Page code makes no other network requests.

## Headers (`vercel.json`, every path)
| Header | Value | Why |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | no MIME sniffing of data or assets |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | the default, set explicitly |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` | the site uses none of these |
| `Content-Security-Policy` | `frame-ancestors 'none'` | no framing (an HTTP header is the only place this directive works); also `X-Frame-Options: DENY` for old browsers |
| `Cross-Origin-Opener-Policy` | `same-origin` | no window handles shared with other origins |

HSTS is left to Vercel, which sets it on the domain.

## Script policy: per-page `<meta http-equiv="Content-Security-Policy">`
A header in `vercel.json` is the same for every page, but the hydration script differs per page, so its hash cannot be listed there. `prerender.ts` already assembles every page's HTML: it hashes each inline executable `<script>` (sha256, base64) and writes this policy into the page's `<head>`:

```
default-src 'self';
script-src 'self' 'sha256-<theme>' 'sha256-<hydration>' https://giscus.app;
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self';
frame-src https://giscus.app;
object-src 'none'; base-uri 'self'; form-action 'self'
```

- `app-shell.html` and `404.html` get the same policy (theme hash only; no hydration script).
- Two policies (the header and the meta) combine: a request must satisfy both.
- `style-src 'unsafe-inline'` stays: it is the cost of React and Radix styles. Scripts are the part that matters, and they stay strict (no `'unsafe-inline'`, no `'unsafe-eval'`).
- A test checks that every inline executable script in a built page has its hash in that page's policy.

## Not doing
- A nonce (needs a server per request), `'strict-dynamic'`, Trusted Types, reporting endpoints, `Report-Only` mode (a meta policy cannot report), COEP/CORP, SRI on same-origin assets.
- Hashing the JSON-LD blocks.

## Verification
- The built site served with the same headers: no CSP violation in the console on the home, topic, chapter, question (giscus loaded and its frame visible), practice, flashcards, cheat sheet, app-shell and 404 pages; Lighthouse best practices 100 on each.
- The headers on the live site are checked with `curl -I` after the next deploy (maintainer merges to `main`).
- Dark mode, the topic menu, search and the Appearance panel still work (they use Radix and inline styles).
