import assert from 'node:assert/strict'
import { test } from 'node:test'
import { candidateFiles, checkSupported, headersFor, matchRule, sourceToRegExp } from './vercelRoutes.ts'

const supported = { cleanUrls: true, trailingSlash: false }

test('`:param` matches one path segment and nothing more', () => {
  const pattern = sourceToRegExp('/practice/:topic/:chapter')
  assert.ok(pattern.test('/practice/react/hooks'))
  assert.ok(!pattern.test('/practice/react'))
  assert.ok(!pattern.test('/practice/react/hooks/extra'))
})

test('`(.*)` matches every path, and dots in a source are literal', () => {
  assert.ok(sourceToRegExp('/(.*)').test('/react/rendering-model'))
  assert.ok(sourceToRegExp('/(.*)').test('/'))
  assert.ok(!sourceToRegExp('/a.b').test('/aXb'))
})

test('finds the first rewrite that matches', () => {
  const rewrites = [
    { source: '/flashcards/:topic', destination: '/app-shell' },
    { source: '/practice/:topic', destination: '/app-shell' },
  ]
  assert.equal(matchRule('/practice/react', rewrites)?.destination, '/app-shell')
  assert.equal(matchRule('/react', rewrites), undefined)
})

test('collects the headers of all matching rules, later ones winning', () => {
  const rules = [
    {
      source: '/(.*)',
      headers: [
        { key: 'A', value: '1' },
        { key: 'B', value: '1' },
      ],
    },
    { source: '/x', headers: [{ key: 'B', value: '2' }] },
  ]
  assert.deepEqual(headersFor('/x', rules), { A: '1', B: '2' })
  assert.deepEqual(headersFor('/y', rules), { A: '1', B: '1' })
})

test('clean URLs try the file, `.html`, then `index.html`; the root is index.html', () => {
  assert.deepEqual(candidateFiles('/react/hooks'), ['react/hooks', 'react/hooks.html', 'react/hooks/index.html'])
  assert.deepEqual(candidateFiles('/'), ['index.html'])
})

test('throws on vercel.json features it does not implement', () => {
  assert.throws(() => checkSupported({ ...supported, functions: {} }), /functions/)
  assert.throws(() => checkSupported({ cleanUrls: false, trailingSlash: false }), /cleanUrls/)
  assert.throws(
    () => checkSupported({ ...supported, rewrites: [{ source: '/a/(?<x>.+)', destination: '/b' }] }),
    /source pattern/,
  )
  assert.doesNotThrow(() => checkSupported({ ...supported, $schema: 'x', buildCommand: 'y' }))
})
