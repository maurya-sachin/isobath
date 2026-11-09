// Content Security Policy for the prerendered pages. Scripts stay strict: the only inline scripts allowed are the ones
// each page actually contains, listed by hash, so a script injected into the page would not run. Written as a `<meta>`
// because the hydration data script differs on every page and a header in vercel.json is the same for all of them.

import { createHash } from 'node:crypto'
import { POSTHOG_API_HOST, POSTHOG_ASSETS_HOST } from '../../src/lib/posthogHost.ts'

const INLINE_SCRIPT = /<script([^>]*)>([\s\S]*?)<\/script>/g
const CHARSET_META = '<meta charset="UTF-8" />'
/** Script types that run code; `application/ld+json` and the like are data and CSP does not cover them. */
const EXECUTABLE_TYPES = ['module', 'text/javascript']

function isExecutableInline(attributes: string): boolean {
  if (/\bsrc\s*=/.test(attributes)) return false
  const type = /\btype\s*=\s*["']([^"']*)["']/.exec(attributes)?.[1]
  return type === undefined || EXECUTABLE_TYPES.includes(type)
}

/** `'sha256-…'` source expressions for the inline scripts in `html` that run code, without duplicates. */
export function inlineScriptHashes(html: string): string[] {
  const hashes = [...html.matchAll(INLINE_SCRIPT)]
    .filter(([, attributes]) => isExecutableInline(attributes))
    .map(([, , code]) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`)
  return [...new Set(hashes)]
}

export function contentSecurityPolicy(scriptHashes: string[]): string {
  return [
    "default-src 'self'",
    `script-src ${["'self'", ...scriptHashes, 'https://giscus.app', POSTHOG_ASSETS_HOST].join(' ')}`,
    // Inline styles: React and Radix set `style` attributes and add <style> elements.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self' ${POSTHOG_API_HOST} ${POSTHOG_ASSETS_HOST}`,
    'frame-src https://giscus.app',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

/** Adds the policy as the first thing after the charset declaration, so it applies before any script. */
export function withContentSecurityPolicy(html: string): string {
  if (!html.includes(CHARSET_META)) throw new Error(`csp: the page has no ${CHARSET_META} to put the policy after`)
  const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(inlineScriptHashes(html))}" />`
  return html.replace(CHARSET_META, () => `${CHARSET_META}\n    ${meta}`)
}
