import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { startServer } from './staticServer.ts'

const dist = mkdtempSync(path.join(tmpdir(), 'static-server-'))
writeFileSync(path.join(dist, 'index.html'), 'home')
writeFileSync(path.join(dist, 'app-shell.html'), 'shell')
writeFileSync(path.join(dist, '404.html'), 'missing')
writeFileSync(path.join(dist, 'roadmap.html'), 'roadmap')
mkdirSync(path.join(dist, 'react'))
writeFileSync(path.join(dist, 'react', 'index.html'), 'react topic')
const config = {
  cleanUrls: true,
  trailingSlash: false,
  rewrites: [{ source: '/practice/:topic', destination: '/app-shell' }],
  redirects: [{ source: '/portfolio', destination: 'https://example.com', permanent: false }],
  headers: [{ source: '/(.*)', headers: [{ key: 'X-Test', value: '1' }] }],
}

async function get(url: string) {
  const response = await fetch(url, { redirect: 'manual' })
  return { status: response.status, body: await response.text(), headers: response.headers }
}

test('serves clean URLs, rewrites, redirects, headers, and 404.html with status 404 for anything else', async () => {
  const server = await startServer(dist, config)
  try {
    assert.equal((await get(`${server.url}/`)).body, 'home')
    assert.equal((await get(`${server.url}/roadmap`)).body, 'roadmap')
    assert.equal((await get(`${server.url}/react`)).body, 'react topic')
    const shell = await get(`${server.url}/practice/react`)
    assert.deepEqual([shell.status, shell.body, shell.headers.get('x-test')], [200, 'shell', '1'])
    const redirect = await get(`${server.url}/portfolio`)
    assert.deepEqual([redirect.status, redirect.headers.get('location')], [307, 'https://example.com'])
    const missing = await get(`${server.url}/does-not-exist`)
    assert.deepEqual([missing.status, missing.body], [404, 'missing'])
  } finally {
    await server.close()
  }
})

test('does not read files outside the site folder', async () => {
  const server = await startServer(dist, config)
  try {
    assert.equal((await get(`${server.url}/%2e%2e/%2e%2e/etc/hosts`)).status, 404)
  } finally {
    await server.close()
  }
})
