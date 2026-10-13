// Serves a built site the way Vercel serves it, from the repo's vercel.json (see vercelRoutes.ts).

import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { candidateFiles, checkSupported, headersFor, matchRule, type VercelConfig } from './vercelRoutes.ts'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}

async function existingFile(distDir: string, pathname: string): Promise<string | undefined> {
  for (const candidate of candidateFiles(pathname)) {
    const file = path.join(distDir, candidate)
    if (!file.startsWith(distDir + path.sep)) continue
    if ((await stat(file).catch(() => undefined))?.isFile()) return file
  }
  return undefined
}

interface Answer {
  status: number
  file?: string
  location?: string
}

async function answerFor(distDir: string, config: VercelConfig, pathname: string): Promise<Answer> {
  const redirect = matchRule(pathname, config.redirects)
  if (redirect) return { status: redirect.permanent ? 308 : 307, location: redirect.destination }
  const rewritten = matchRule(pathname, config.rewrites)?.destination
  const file =
    (await existingFile(distDir, pathname)) ?? (rewritten ? await existingFile(distDir, rewritten) : undefined)
  if (file) return { status: 200, file }
  return { status: 404, file: path.join(distDir, '404.html') }
}

/** Starts the server on a free port; `close` stops it. */
export async function startServer(distDir: string, config: VercelConfig) {
  checkSupported(config)
  const root = path.resolve(distDir)
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    void answerFor(root, config, pathname).then(async ({ status, file, location }) => {
      const headers: Record<string, string> = headersFor(pathname, config.headers)
      if (location) headers.Location = location
      if (file) headers['Content-Type'] = CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream'
      response.writeHead(status, headers)
      response.end(file ? await readFile(file) : undefined)
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}
