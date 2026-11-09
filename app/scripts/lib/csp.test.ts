import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { POSTHOG_API_HOST, POSTHOG_ASSETS_HOST } from '../../src/lib/posthogHost.ts'
import { contentSecurityPolicy, inlineScriptHashes, withContentSecurityPolicy } from './csp.ts'

const hashOf = (code: string) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`

test('hashes the inline scripts that run code, exactly as written between the tags', () => {
  const html = '<script>var a = 1</script><script type="module">import "x"</script>'
  assert.deepEqual(inlineScriptHashes(html), [hashOf('var a = 1'), hashOf('import "x"')])
})

test('skips external scripts and data blocks, and lists a repeated script once', () => {
  const html = [
    '<script type="module" crossorigin src="/assets/index.js"></script>',
    '<script type="application/ld+json">{"@type":"WebSite"}</script>',
    '<script>same()</script>',
    '<script>same()</script>',
  ].join('')
  assert.deepEqual(inlineScriptHashes(html), [hashOf('same()')])
})

test('keeps scripts strict: no unsafe-inline or unsafe-eval, and giscus allowed for its script and frame', () => {
  const policy = contentSecurityPolicy([hashOf('a')])
  const scriptSrc = policy.split('; ').find((part) => part.startsWith('script-src'))!
  assert.ok(scriptSrc.includes("'self'") && scriptSrc.includes(hashOf('a')) && scriptSrc.includes('https://giscus.app'))
  assert.ok(!scriptSrc.includes('unsafe'))
  assert.ok(policy.includes('frame-src https://giscus.app') && policy.includes("object-src 'none'"))
})

test('puts the policy meta right after the charset, with the hashes of the page it is in', () => {
  const html = '<head>\n    <meta charset="UTF-8" />\n    <title>t</title><script>boot()</script></head>'
  const result = withContentSecurityPolicy(html)
  assert.ok(result.indexOf('Content-Security-Policy') > result.indexOf('charset'))
  assert.ok(result.indexOf('Content-Security-Policy') < result.indexOf('<title>'))
  assert.ok(result.includes(hashOf('boot()')))
})

test('refuses a page it has nowhere to put the policy in', () => {
  assert.throws(() => withContentSecurityPolicy('<head></head>'), /charset/)
})

test("allows PostHog's EU hosts for requests and its extension scripts, and nothing else new", () => {
  const policy = contentSecurityPolicy([])
  const directive = (name: string) => policy.split('; ').find((part) => part.startsWith(name))!
  const connectSrc = directive('connect-src')
  assert.ok(
    connectSrc.includes("'self'") && connectSrc.includes(POSTHOG_API_HOST) && connectSrc.includes(POSTHOG_ASSETS_HOST),
  )
  assert.ok(directive('script-src').includes(POSTHOG_ASSETS_HOST) && !directive('script-src').includes('unsafe'))
  assert.equal(directive('default-src'), "default-src 'self'")
})
