// Runnable code examples: finds ```js blocks that state their output with `// →` comments
// and compares that claim with what Node prints. Pure logic; scripts/examples.ts runs the code.

import type { Code, Nodes } from 'mdast'
import { parseMarkdown } from './markdown.ts'

export interface ExampleFile {
  name: string
  code: string
}

export interface Example {
  /** Line of the opening fence in the file. */
  line: number
  /** Files written into the run's directory: one, or several for a fence with `// name.ext` header lines. */
  files: ExampleFile[]
  /** Files to run, in order: the single file, or those named by `run=`. A `.mjs` file is a strict ES module; `.cjs` is sloppy-mode CommonJS. */
  entries: string[]
  /** Extra `node` flags, from the fence meta `node=`. */
  nodeFlags: string[]
  /** Extra environment variables, from the fence meta `env=NAME=value`. */
  env: Record<string, string>
  /** Text after each `// →`, in source order. */
  expected: string[]
}

const OUTPUT_COMMENT = /\/\/ →\s*(.*)$/
/** A `//` line indented past the marker continues the output above it: `//   42`. */
const OUTPUT_CONTINUATION = /^\s*\/\/ {2,}(\S.*)$/
/** A line that starts a file in a `files` fence: `// lib.cjs`, optionally followed by a note (`// main.mjs: what it shows`). */
const FILE_HEADER = /^\/\/ ([\w.-]+\.(?:mjs|cjs|js|json))(?![\w.-])/
const ALLOWED_NODE_FLAGS = ['--expose-gc', '--allow-natives-syntax']
const ELISION = /…|\.\.\./

interface Meta {
  /** Opt out of running. */
  noRun: boolean
  /** Run as sloppy-mode CommonJS. */
  script: boolean
  /** Run after the previous js fence of the file, whose output is silenced. */
  continues: boolean
  /** The fence holds several files, each started by a `// name.ext` line. */
  files: boolean
  /** The files to run, from `run=a.mjs,b.cjs`. */
  run: string[]
  nodeFlags: string[]
  env: Record<string, string>
}

const fail = (node: Code, message: string): never => {
  throw new Error(`line ${node.position?.start.line ?? 0}: ${message}`)
}

function parseMeta(node: Code): Meta {
  const tokens = node.meta?.split(/\s+/).filter(Boolean) ?? []
  const valuesOf = (key: string) =>
    tokens.filter((token) => token.startsWith(`${key}=`)).map((token) => token.slice(key.length + 1))
  const nodeFlags = valuesOf('node').flatMap((value) => value.split(','))
  const rejected = nodeFlags.find((flag) => !ALLOWED_NODE_FLAGS.includes(flag))
  if (rejected !== undefined) fail(node, `\`node=${rejected}\` is not allowed (${ALLOWED_NODE_FLAGS.join(', ')})`)
  if (!tokens.includes('files') && valuesOf('run').length > 0) fail(node, '`run=` needs the `files` meta')
  return {
    noRun: tokens.includes('no-run'),
    script: tokens.includes('script'),
    continues: tokens.includes('continues'),
    files: tokens.includes('files'),
    run: valuesOf('run').flatMap((value) => value.split(',')),
    nodeFlags,
    env: Object.fromEntries(
      valuesOf('env').map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)]),
    ),
  }
}

/** The ```js blocks of a Markdown file that claim an output; blocks marked `no-run` are counted in `skipped`. */
export function extractExamples(markdown: string): { examples: Example[]; skipped: number } {
  const blocks: Code[] = []
  visitCode(parseMarkdown(markdown), (node) => {
    if (node.lang === 'js') blocks.push(node)
  })
  const examples: Example[] = []
  let skipped = 0
  blocks.forEach((node, index) => {
    const expected = expectedOutput(node.value)
    if (expected.length === 0) return
    const meta = parseMeta(node)
    if (meta.noRun) skipped++
    else examples.push(toExample(blocks, index, meta, expected))
  })
  return { examples, skipped }
}

function toExample(blocks: Code[], index: number, meta: Meta, expected: string[]): Example {
  const node = blocks[index]
  const code = fullCode(blocks, index)
  const files = meta.files ? splitFiles(node, code) : [{ name: meta.script ? 'example.cjs' : 'example.mjs', code }]
  const entries = meta.files ? entriesOf(node, meta, files) : [files[0].name]
  return { line: node.position?.start.line ?? 0, files, entries, nodeFlags: meta.nodeFlags, env: meta.env, expected }
}

/** The files named by `run=`, which must exist. */
function entriesOf(node: Code, meta: Meta, files: ExampleFile[]): string[] {
  if (meta.run.length === 0) fail(node, 'a `files` fence needs `run=<file>` naming what to run')
  const missing = meta.run.find((name) => !files.some((file) => file.name === name))
  if (missing !== undefined) fail(node, `\`run=${missing}\` is not a file in this fence`)
  return meta.run
}

/** A block's code, preceded by the code of the fence it `continues`, with that code's own output silenced. */
function fullCode(blocks: Code[], index: number): string {
  const node = blocks[index]
  if (!parseMeta(node).continues) return node.value
  if (index === 0) fail(node, '`continues` needs an earlier js fence')
  return `const __log = console.log\nconsole.log = () => {}\n${fullCode(blocks, index - 1)}\nconsole.log = __log\n${node.value}`
}

/** The files of a `files` fence, each starting at its `// name.ext` line. */
function splitFiles(node: Code, code: string): ExampleFile[] {
  const lines = code.split('\n')
  const starts = lines.flatMap((text, index) => {
    const name = FILE_HEADER.exec(text)?.[1]
    return name ? [{ name, index }] : []
  })
  if (starts.length === 0) fail(node, 'a `files` fence needs `// name.ext` lines')
  if (lines.slice(0, starts[0].index).some((text) => text.trim() !== ''))
    fail(node, 'code before the first file header')
  return starts.map(({ name, index }, position) => ({
    name,
    code: lines.slice(index + 1, starts[position + 1]?.index ?? lines.length).join('\n'),
  }))
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
