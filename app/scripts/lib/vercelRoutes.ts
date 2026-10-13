// The slice of vercel.json that this repo uses (clean URLs, rewrites, redirects, headers), so the smoke test can serve
// `dist` the way Vercel does. Anything else in the file is an error: the server must not silently differ from production.

export interface Rule {
  source: string
  destination: string
  permanent?: boolean
}

export interface HeaderRule {
  source: string
  headers: { key: string; value: string }[]
}

export interface VercelConfig {
  cleanUrls?: boolean
  trailingSlash?: boolean
  rewrites?: Rule[]
  redirects?: Rule[]
  headers?: HeaderRule[]
  [key: string]: unknown
}

/** Keys that only matter to Vercel's build, not to serving files. */
const BUILD_ONLY_KEYS = ['$schema', 'installCommand', 'buildCommand', 'outputDirectory']
const SERVING_KEYS = ['cleanUrls', 'trailingSlash', 'rewrites', 'redirects', 'headers']
/** What a `source` may contain: path segments, `:name` parameters and `(.*)`. */
const SUPPORTED_SOURCE = /^[\w\-./:()*]+$/

export function checkSupported(config: VercelConfig): void {
  const unknown = Object.keys(config).filter((key) => ![...BUILD_ONLY_KEYS, ...SERVING_KEYS].includes(key))
  if (unknown.length > 0) throw new Error(`vercel.json: the smoke server does not implement ${unknown.join(', ')}`)
  if (config.cleanUrls !== true || config.trailingSlash !== false) {
    throw new Error('vercel.json: the smoke server only implements cleanUrls: true and trailingSlash: false')
  }
  const sources = [...(config.rewrites ?? []), ...(config.redirects ?? []), ...(config.headers ?? [])].map(
    (rule) => rule.source,
  )
  const bad = sources.find((source) => !SUPPORTED_SOURCE.test(source))
  if (bad !== undefined) throw new Error(`vercel.json: the smoke server cannot read the source pattern "${bad}"`)
}

/** `/practice/:topic` matches `/practice/react`; `(.*)` matches anything. */
export function sourceToRegExp(source: string): RegExp {
  const pattern = source
    .split(/(\(\.\*\)|:\w+)/)
    .map((part) => {
      if (part === '(.*)') return '.*'
      if (part.startsWith(':')) return '[^/]+'
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${pattern}$`)
}

export function matchRule(pathname: string, rules: Rule[] = []): Rule | undefined {
  return rules.find((rule) => sourceToRegExp(rule.source).test(pathname))
}

/** The headers of every rule that matches `pathname`, later rules winning. */
export function headersFor(pathname: string, rules: HeaderRule[] = []): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const rule of rules.filter((candidate) => sourceToRegExp(candidate.source).test(pathname))) {
    for (const { key, value } of rule.headers) headers[key] = value
  }
  return headers
}

/** Files that can answer `pathname`, in order: the file itself, then clean URLs (`/x` → `x.html`, `x/index.html`). */
export function candidateFiles(pathname: string): string[] {
  const path = pathname.replace(/^\/+|\/+$/g, '')
  if (path === '') return ['index.html']
  return [path, `${path}.html`, `${path}/index.html`]
}
