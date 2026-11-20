import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
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

test('names no analytics host: PostHog is reached through the same-origin proxy', () => {
  const policy = contentSecurityPolicy([])
  const directive = (name: string) => policy.split('; ').find((part) => part.startsWith(name))!
  assert.ok(!policy.includes('posthog'))
  assert.equal(directive('connect-src'), "connect-src 'self'")
  assert.equal(directive('default-src'), "default-src 'self'")
})
