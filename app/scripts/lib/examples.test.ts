import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractExamples, outputMatches, printedOutput } from './examples.ts'

const fence = (info: string, code: string) => `Intro\n\n\`\`\`${info}\n${code}\n\`\`\`\n`

test('extracts js blocks with output comments and records their line', () => {
  const { examples } = extractExamples(fence('js', 'console.log(1 + 2) // → 3\n// → done'))
  assert.equal(examples.length, 1)
  assert.deepEqual(examples[0].expected, ['3', 'done'])
  assert.equal(examples[0].line, 3)
})

test('reads indented `//` lines after an output comment as more output', () => {
  const { examples } = extractExamples(fence('js', 'a // → hint\n//   42\n// note\n//   not output'))
  assert.deepEqual(examples[0].expected, ['hint', '42'])
})

test('ignores other languages and js blocks without output comments', () => {
  assert.equal(extractExamples(fence('ts', 'a // → 1')).examples.length, 0)
  assert.equal(extractExamples(fence('js', 'const a = 1')).examples.length, 0)
})

test('counts `no-run` blocks as skipped, not run', () => {
  const result = extractExamples(fence('js no-run', 'x // → 1'))
  assert.deepEqual([result.examples.length, result.skipped], [0, 1])
})

test('runs blocks as modules unless the fence meta says `script`', () => {
  assert.equal(extractExamples(fence('js', 'x // → 1')).examples[0].mode, 'module')
  assert.equal(extractExamples(fence('js script', 'x // → 1')).examples[0].mode, 'script')
})

test('matches output ignoring whitespace', () => {
  assert.equal(outputMatches(['[ 1, 2 ]'], '[\n  1,\n  2\n]\n'), true)
  assert.equal(outputMatches(['3'], '4\n'), false)
})

test('treats … as an elision between parts that must appear in order', () => {
  assert.equal(outputMatches(['TypeError: Cannot read … of undefined'], 'TypeError: Cannot read properties of undefined'), true)
  assert.equal(outputMatches(['a … c'], 'a b c'), true)
  assert.equal(outputMatches(['a … c'], 'c b a'), false)
  assert.equal(outputMatches(['a … a'], 'a'), false)
})

test('adds the uncaught error line only when the process failed', () => {
  const stderr = 'file:1\nthrow x\n^\nTypeError: bad\n    at x'
  assert.equal(printedOutput('out\n', stderr, 1), 'out\nTypeError: bad')
  assert.equal(printedOutput('out\n', stderr, 0), 'out\n')
})
