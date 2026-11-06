// smoke — loads one page of each kind from the built site in a real browser at 4 widths, light and dark, 100% and
// 145% text, and fails on horizontal overflow, console errors, CSP violations, axe-core violations or a keyboard trap.
// Run after `npm run build`: `npm run smoke -- --browser chrome|firefox [--page /path]` (`--page` runs one page only). Safari and real devices are manual checks.

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import puppeteer, { type Browser, type HTTPResponse, type Page } from 'puppeteer-core'
import { cspViolations, focusedText, hiddenFocus, overflowOffenders, prepareStorage, runAxe } from './lib/inPage.ts'
import { describeRun, formatReport, runMatrix, type Failure, type Finding, type Run } from './lib/smoke.ts'
import { startServer } from './lib/staticServer.ts'
import type { VercelConfig } from './lib/vercelRoutes.ts'

const NAVIGATION_TIMEOUT_MS = 30_000
const TAB_PRESSES = 40
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const BROWSER_PATHS = {
  chrome: [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ],
  firefox: [process.env.FIREFOX_PATH, '/Applications/Firefox.app/Contents/MacOS/firefox', '/usr/bin/firefox'],
} as const

type BrowserName = keyof typeof BROWSER_PATHS

function browserName(): BrowserName {
  const name = process.argv[process.argv.indexOf('--browser') + 1] ?? 'chrome'
  if (name !== 'chrome' && name !== 'firefox') throw new Error(`--browser must be chrome or firefox, not ${name}`)
  return name
}

function executablePath(name: BrowserName): string {
  const found = BROWSER_PATHS[name].find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error(`No ${name} found; set ${name === 'chrome' ? 'CHROME_PATH' : 'FIREFOX_PATH'}`)
  return found
}

/** Console errors, uncaught exceptions and failed same-origin requests, collected while the page loads. */
function watchPage(page: Page, origin: string, isExpected404: boolean) {
  const problems: string[] = []
  page.on('console', (message) => {
    // Chrome logs the 404 page's own status as a console error; a 404 for anything else is caught by `response` below.
    if (isExpected404 && message.text().includes('status of 404')) return
    if (message.type() === 'error') problems.push(`console: ${message.text().slice(0, 200)}`)
  })
  page.on('pageerror', (error) => problems.push(`exception: ${String(error).slice(0, 200)}`))
  page.on('response', (response) => {
    const isPage = response.request().isNavigationRequest()
    if (response.status() >= 400 && response.url().startsWith(origin) && !(isPage && isExpected404)) {
      problems.push(`${response.status()} ${response.url().slice(origin.length)}`)
    }
  })
  return problems
}

function statusProblems(response: HTTPResponse | null, run: Run): Failure[] {
  const status = response?.status()
  return status === run.page.status
    ? []
    : [{ check: 'status', detail: `answered ${status}, expected ${run.page.status}` }]
}

async function overflowProblems(page: Page): Promise<Failure[]> {
  const offenders = await page.evaluate(overflowOffenders)
  if (!offenders) return []
  return [
    { check: 'overflow', detail: `wider than the window; first offenders: ${offenders.join(', ') || 'none found'}` },
  ]
}

async function axeProblems(page: Page, axeSource: string): Promise<Failure[]> {
  await page.evaluate(axeSource)
  const violations = await page.evaluate(runAxe, AXE_TAGS)
  return violations.map(({ id, count, target }) => ({
    check: 'axe',
    detail: `${id} (${count} node${count === 1 ? '' : 's'}), e.g. ${target}`,
  }))
}

async function keyboardProblems(page: Page): Promise<Failure[]> {
  await page.keyboard.press('Tab')
  const first = await page.evaluate(focusedText)
  if (!first.includes('Skip to content')) {
    return [{ check: 'keyboard', detail: `the first Tab focused "${first.slice(0, 30)}", not the skip link` }]
  }
  for (let press = 0; press < TAB_PRESSES; press++) {
    await page.keyboard.press('Tab')
    const hidden = await page.evaluate(hiddenFocus)
    if (hidden) return [{ check: 'keyboard', detail: `Tab ${press + 2} focused a hidden element: ${hidden}` }]
  }
  return []
}

async function visit(browser: Browser, origin: string, run: Run, axeSource: string): Promise<Failure[]> {
  const page = await browser.newPage()
  try {
    const watched = watchPage(page, origin, run.page.status === 404)
    await page.setViewport({ width: run.width, height: 900 })
    await page.evaluateOnNewDocument(prepareStorage, run.theme, run.textSize)
    const response = await page.goto(origin + run.page.path, {
      waitUntil: 'networkidle0',
      timeout: NAVIGATION_TIMEOUT_MS,
    })
    const violations = await page.evaluate(cspViolations)
    return [
      ...statusProblems(response, run),
      ...[...watched, ...violations.map((violation) => `csp: ${violation}`)].map((detail): Failure => ({
        check: 'console',
        detail,
      })),
      ...(await overflowProblems(page)),
      ...(await axeProblems(page, axeSource)),
      ...(await keyboardProblems(page)),
    ]
  } finally {
    await page.close()
  }
}

const name = browserName()
const distDir = path.resolve('dist')
const config = JSON.parse(await readFile(path.resolve('..', 'vercel.json'), 'utf8')) as VercelConfig
const axeSource = await readFile(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')
const server = await startServer(distDir, config)
const browser = await puppeteer.launch({ browser: name, executablePath: executablePath(name), headless: true })

const onlyPage = process.argv[process.argv.indexOf('--page') + 1]
const runs = runMatrix().filter((run) => !process.argv.includes('--page') || run.page.path === onlyPage)
const findings: Finding[] = []
try {
  for (const run of runs) {
    const failures = await visit(browser, server.url, run, axeSource)
    for (const failure of failures) findings.push({ ...failure, run })
    if (failures.length > 0) console.error(`✖ ${describeRun(run)}: ${failures.length}`)
  }
} finally {
  await browser.close()
  await server.close()
}

console.log(formatReport(name, runs.length, findings))
process.exitCode = findings.length > 0 ? 1 : 0
