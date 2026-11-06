import type { MouseEvent } from 'react'
import { useNavigate } from 'react-router'

const isPlainLeftClick = (event: MouseEvent) =>
  !event.defaultPrevented && event.button === 0 && !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)

const questionLinkHref = (target: EventTarget) =>
  target instanceof Element ? target.closest('a[data-question-link]')?.getAttribute('href') : null

/**
 * Click handler for compiled content: links to other questions (marked `data-question-link` by content:build)
 * navigate inside the app instead of reloading. Modified clicks keep the browser's default (new tab, etc.).
 */
export function useQuestionLinkClick() {
  const navigate = useNavigate()
  return (event: MouseEvent<HTMLElement>) => {
    if (!isPlainLeftClick(event)) return
    const href = questionLinkHref(event.target)
    if (!href) return
    event.preventDefault()
    void navigate(href)
  }
}
