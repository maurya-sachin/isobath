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
  assert.deepEqual(extractExamples(fence('js', 'x // → 1')).examples[0].entries, ['example.mjs'])
  assert.deepEqual(extractExamples(fence('js script', 'x // → 1')).examples[0].entries, ['example.cjs'])
})

test('reads allowed Node flags and environment variables from the fence meta', () => {
  const [example] = extractExamples(
    fence('js node=--expose-gc,--allow-natives-syntax env=A=1 env=B=two', 'x // → 1'),
  ).examples
  assert.deepEqual(example.nodeFlags, ['--expose-gc', '--allow-natives-syntax'])
  assert.deepEqual(example.env, { A: '1', B: 'two' })
})

test('rejects a Node flag that is not on the allow-list', () => {
  assert.throws(() => extractExamples(fence('js node=--inspect', 'x // → 1')), /--inspect/)
})

test('`files` splits a fence at `// name.ext` lines and `run=` names the files to run, in order', () => {
  const code = [
    '// lib.cjs',
    'exports.a = 1',
    '',
    '// main.mjs: ESM importing CommonJS',
    "import lib from './lib.cjs'",
    'console.log(lib.a) // → 1',
    '// main.cjs (entry point)',
    "console.log(require('./lib.cjs').a) // → 1",
  ].join('\n')
  const [example] = extractExamples(fence('js files run=main.mjs,main.cjs', code)).examples
  assert.deepEqual(
    example.files.map((file) => file.name),
    ['lib.cjs', 'main.mjs', 'main.cjs'],
  )
  assert.deepEqual(example.entries, ['main.mjs', 'main.cjs'])
  assert.equal(example.files[0].code, 'exports.a = 1\n')
})

test('without `files`, header-like comments are ordinary comments and the fence is one file', () => {
  const [example] = extractExamples(fence('js', '// example.mjs\nconsole.log(1) // → 1')).examples
  assert.deepEqual(example.entries, ['example.mjs'])
  assert.equal(example.files.length, 1)
})

test('rejects a `files` fence with no `run=`, an unknown entry, or code before the first header', () => {
  assert.throws(() => extractExamples(fence('js files', '// main.mjs\nx // → 1')), /run=/)
  assert.throws(() => extractExamples(fence('js files run=other.mjs', '// main.mjs\nx // → 1')), /other\.mjs/)
  assert.throws(
    () => extractExamples(fence('js files run=main.mjs', 'oops()\n// main.mjs\nx // → 1')),
    /before the first/,
  )
  assert.throws(() => extractExamples(fence('js run=main.mjs', 'x // → 1')), /files/)
})

test('`continues` puts the previous js fence first, with its output silenced', () => {
  const markdown =
    fence('js', 'const a = 1\nconsole.log(a) // → 1') + fence('js continues', 'console.log(a + 1) // → 2')
  const { examples } = extractExamples(markdown)
  assert.equal(examples.length, 2)
  const code = examples[1].files[0].code
  assert.match(code, /const a = 1/)
  assert.ok(code.indexOf('console.log = () => {}') < code.indexOf('const a = 1'))
  assert.ok(code.indexOf('const a = 1') < code.indexOf('console.log = __log'))
  assert.ok(code.endsWith('console.log(a + 1) // → 2'))
  assert.deepEqual(examples[1].expected, ['2'])
})

test('`continues` chains through earlier continuing fences and needs an earlier fence', () => {
  const markdown =
    fence('js', 'const a = 1') +
    fence('js continues', 'const b = a + 1') +
    fence('js continues', 'console.log(b) // → 2')
  const code = extractExamples(markdown).examples[0].files[0].code
  assert.ok(code.includes('const a = 1') && code.includes('const b = a + 1'))
  assert.throws(() => extractExamples(fence('js continues', 'x // → 1')), /continues/)
})

test('matches output ignoring whitespace', () => {
  assert.equal(outputMatches(['[ 1, 2 ]'], '[\n  1,\n  2\n]\n'), true)
  assert.equal(outputMatches(['3'], '4\n'), false)
})

test('treats … as an elision between parts that must appear in order', () => {
  assert.equal(
    outputMatches(['TypeError: Cannot read … of undefined'], 'TypeError: Cannot read properties of undefined'),
    true,
  )
  assert.equal(outputMatches(['a … c'], 'a b c'), true)
  assert.equal(outputMatches(['a … c'], 'c b a'), false)
  assert.equal(outputMatches(['a … a'], 'a'), false)
})

test('adds the uncaught error line only when the process failed', () => {
  const stderr = 'file:1\nthrow x\n^\nTypeError: bad\n    at x'
  assert.equal(printedOutput('out\n', stderr, 1), 'out\nTypeError: bad')
  assert.equal(printedOutput('out\n', stderr, 0), 'out\n')
})

test('extracts ts blocks as type-stripped modules and keeps languages apart', () => {
  const markdown = fence('ts', 'const n: number = 1 // → 1') + fence('js', 'x // → 2')
  const { examples } = extractExamples(markdown, 'ts')
  assert.deepEqual(
    [examples.length, examples[0].entries, extractExamples(markdown).examples.length],
    [1, ['example.mts'], 1],
  )
})

test('does not run a ts block that claims a compiler error, and counts it skipped', () => {
  const { examples, skipped } = extractExamples(fence('ts', 'f() // → 1\nbad\n// Error TS2304: x'), 'ts')
  assert.deepEqual([examples.length, skipped], [0, 1])
})
