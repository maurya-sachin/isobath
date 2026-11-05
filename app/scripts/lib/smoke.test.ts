import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PAGES, runMatrix, formatReport, WIDTHS } from './smoke.ts'

test('the matrix covers every page at every width, theme and text size', () => {
  const runs = runMatrix()
  assert.equal(runs.length, PAGES.length * WIDTHS.length * 2 * 2)
  assert.equal(new Set(runs.map((run) => `${run.page.path}${run.width}${run.theme}${run.textSize}`)).size, runs.length)
})

test('expects the unknown URL to answer 404 and every other page 200', () => {
  assert.deepEqual(
    PAGES.filter((page) => page.status === 404).map((page) => page.path),
    ['/does-not-exist'],
  )
})

test('a clean run reports success; failures list the check, the run and the detail', () => {
  const [run] = runMatrix()
  assert.match(formatReport('chrome', 3, []), /✔ chrome: 3 runs/)
  const report = formatReport('firefox', 3, [{ run, check: 'overflow', detail: '400 px wide' }])
  assert.match(report, /\[overflow\] \/ · 375px · light · 100%/)
  assert.match(report, /400 px wide/)
  assert.match(report, /1 problem\(s\) in 3 runs/)
})
