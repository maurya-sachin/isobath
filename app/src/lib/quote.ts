// A quote for "Suggest a fix": the reader's selection, capped so the issue URL stays short, and fenced so GitHub
// shows it literally (code keeps its indentation; `<Fragment>` is not read as HTML).

/** In code points. 500 percent-encoded worst-case code points stay well under the 8000-octet URL length RFC 9110 asks servers to support. */
export const MAX_QUOTE = 500

export interface Quote {
  text: string
  /** Length of the whole selection, in code points. */
  length: number
  truncated: boolean
}

/** The selection trimmed at both ends, or null when that leaves nothing. A longer one is cut at a code point and marked. */
export function toQuote(selected: string): Quote | null {
  const points = Array.from(selected.trim())
  if (points.length === 0) return null
  const truncated = points.length > MAX_QUOTE
  const text = truncated ? `${points.slice(0, MAX_QUOTE).join('')} […]` : points.join('')
  return { text, length: points.length, truncated }
}

/** A Markdown code fence around the text, longer than any run of backticks inside it, so the text cannot end it early. */
export function fenced(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${fence}text\n${text}\n${fence}`
}
