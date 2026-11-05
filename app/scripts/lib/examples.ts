// Runnable code examples: finds ```js blocks that state their output with `// →` comments
// and compares that claim with what Node prints. Pure logic; scripts/examples.ts runs the code.

import type { Code, Nodes } from 'mdast'
import { parseMarkdown } from './markdown.ts'

export interface Example {
  /** Line of the opening fence in the file. */
  line: number
  code: string
  /** `module` (default): strict, ES module. `script`: sloppy-mode CommonJS, for examples about sloppy mode or `process.nextTick` ordering. */
  mode: 'module' | 'script'
  /** Text after each `// →`, in source order. */
  expected: string[]
}

const OUTPUT_COMMENT = /\/\/ →\s*(.*)$/
/** A `//` line indented past the marker continues the output above it: `//   42`. */
const OUTPUT_CONTINUATION = /^\s*\/\/ {2,}(\S.*)$/
const OPT_OUT = 'no-run'
const SCRIPT_MODE = 'script'
const ELISION = /…|\.\.\./

/** The ```js blocks of a Markdown file that claim an output; blocks marked `no-run` are returned in `skipped`. */
export function extractExamples(markdown: string): { examples: Example[]; skipped: number } {
  const examples: Example[] = []
  let skipped = 0
  visitCode(parseMarkdown(markdown), (node) => {
    if (node.lang !== 'js') return
    const expected = expectedOutput(node.value)
    if (expected.length === 0) return
    const meta = node.meta?.split(/\s+/) ?? []
    if (meta.includes(OPT_OUT)) skipped++
    else
      examples.push({
        line: node.position?.start.line ?? 0,
        code: node.value,
        mode: meta.includes(SCRIPT_MODE) ? 'script' : 'module',
        expected,
      })
  })
  return { examples, skipped }
}

function expectedOutput(code: string): string[] {
  const expected: string[] = []
  let continuing = false
  for (const line of code.split('\n')) {
    const text: string | undefined =
      OUTPUT_COMMENT.exec(line)?.[1] ?? (continuing ? OUTPUT_CONTINUATION.exec(line)?.[1] : undefined)
    if (text !== undefined) expected.push(text)
    continuing = text !== undefined
  }
  return expected
}

function visitCode(node: Nodes, visit: (code: Code) => void): void {
  if (node.type === 'code') visit(node)
  if ('children' in node) node.children.forEach((child) => visitCode(child, visit))
}

const withoutWhitespace = (text: string) => text.replace(/\s+/g, '')

/**
 * Whether the printed output matches the `// →` comments. Whitespace is ignored (the comments are hand-formatted,
 * `util.inspect` wraps lines). `…` in a comment elides output: the parts around it must appear in order.
 */
export function outputMatches(expected: string[], actual: string): boolean {
  const output = withoutWhitespace(actual)
  const parts = withoutWhitespace(expected.join('\n')).split(ELISION)
  if (parts.length === 1) return output === parts[0]
  if (!output.startsWith(parts[0]) || !output.endsWith(parts[parts.length - 1])) return false
  let cursor = parts[0].length
  for (const part of parts.slice(1, -1)) {
    const at = output.indexOf(part, cursor)
    if (at === -1) return false
    cursor = at + part.length
  }
  return cursor <= output.length - parts[parts.length - 1].length
}

const ERROR_LINE = /^[A-Za-z]*Error(?: \[\w+\])?: .*/m

/** What the example printed: stdout, plus the uncaught error's `Name: message` line when the process failed. */
export function printedOutput(stdout: string, stderr: string, exitCode: number | null): string {
  if (exitCode === 0) return stdout
  return stdout + (ERROR_LINE.exec(stderr)?.[0] ?? '')
}
