import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compilerErrorCodes, expectedErrorCodes, extractTypeChecks, sameErrorCodes } from './typecheck.ts'

const fence = (info: string, code: string) => `Intro\n\n\`\`\`${info}\n${code}\n\`\`\`\n`

test('reads error codes from comments, with or without a colon, indented or trailing', () => {
  const code = 'a\n// Error TS2345: x\n  // Error: TS2352: y\nb // error TS7006'
  assert.deepEqual(expectedErrorCodes(code), [2345, 2352, 7006])
})

test('reads a version prefix and several codes in one comment', () => {
  assert.deepEqual(expectedErrorCodes('// 7.0.2 Error: TS2367: a'), [2367])
  assert.deepEqual(expectedErrorCodes('// Error TS1238 and TS1270: a'), [1238, 1270])
  assert.deepEqual(expectedErrorCodes('// Error TS1, TS2: a'), [1, 2])
})

test('extracts only ts blocks that claim an error, with the fence line', () => {
  const markdown =
    fence('ts', 'let a: number = "x"\n// Error TS2322: no') + fence('ts', 'const b = 1') + fence('js', '// Error TS1')
  const { checks, skipped } = extractTypeChecks(markdown)
  assert.deepEqual([checks.length, skipped, checks[0].line, checks[0].expected], [1, 0, 3, [2322]])
})

test('counts `no-run` blocks as skipped, not checked', () => {
  const { checks, skipped } = extractTypeChecks(fence('ts no-run', 'x\n// Error TS2322'))
  assert.deepEqual([checks.length, skipped], [0, 1])
})

test('the compiler reports the code of a type error and nothing for valid code', () => {
  assert.deepEqual(compilerErrorCodes('const a: number = "x"'), [2322])
  assert.deepEqual(compilerErrorCodes('const a: number = 1'), [])
})

test('top-level names do not clash with lib globals', () => {
  assert.deepEqual(compilerErrorCodes('const name = 1\nconst status = 2'), [])
})

test('compares the kinds of error, ignoring order and repeats', () => {
  assert.equal(sameErrorCodes([2322, 2345], [2345, 2322]), true)
  assert.equal(sameErrorCodes([2322], [2322, 2322]), true)
  assert.equal(sameErrorCodes([2322], [2322, 2345]), false)
  assert.equal(sameErrorCodes([2322], []), false)
})
