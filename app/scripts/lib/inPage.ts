/// <reference lib="dom" />
// Functions that run inside the page under test (puppeteer serialises them), so each must use only its arguments and
// the page's own globals. Kept apart from smoke.ts so the Node code has no DOM types in scope.

interface AxeResults {
  violations: { id: string; nodes: { target: unknown[] }[] }[]
}

declare global {
  interface Window {
    __cspViolations: string[]
    axe: { run: (context: Document, options: object) => Promise<AxeResults> }
  }
}

export interface AxeViolation {
  id: string
  count: number
  target: string
}

/** Before the page's own scripts: the theme and text size the way the app stores them, and a CSP violation log. */
export function prepareStorage(theme: string, textSize: number): void {
  localStorage.setItem('theme', theme)
  localStorage.setItem('appearance', JSON.stringify({ textSize }))
  window.__cspViolations = []
  document.addEventListener('securitypolicyviolation', (event) => {
    window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI || 'inline'}`)
  })
}

export const cspViolations = (): string[] => window.__cspViolations

/** The first few elements reaching past the window's right edge, or `null` when the page does not overflow. */
export function overflowOffenders(): string[] | null {
  const width = document.documentElement.clientWidth
  if (document.documentElement.scrollWidth <= width) return null
  return [...document.querySelectorAll('body *')]
    .filter((element) => element.getBoundingClientRect().right > width + 1)
    .slice(0, 3)
    .map(
      (element) =>
        `${element.tagName.toLowerCase()}${element.className ? '.' + String(element.className).split(' ')[0] : ''}`,
    )
}

/** Needs axe-core's source evaluated in the page first. */
export async function runAxe(tags: string[]): Promise<AxeViolation[]> {
  const results = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })
  return results.violations.map((violation) => ({
    id: violation.id,
    count: violation.nodes.length,
    target: violation.nodes[0].target.join(' '),
  }))
}

export const focusedText = (): string => document.activeElement?.textContent?.trim() ?? ''

/** Describes the focused element when it cannot be seen, otherwise `null`. */
export function hiddenFocus(): string | null {
  const element = document.activeElement
  if (!element || element === document.body) return null
  const box = element.getBoundingClientRect()
  const style = getComputedStyle(element)
  const hidden = box.width === 0 || box.height === 0 || style.visibility === 'hidden' || style.display === 'none'
  return hidden ? `${element.tagName.toLowerCase()} "${(element.textContent ?? '').trim().slice(0, 30)}"` : null
}
