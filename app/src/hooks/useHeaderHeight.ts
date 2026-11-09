import { useEffect, type RefObject } from 'react'

/**
 * Publishes the sticky header's height as `--header-height` on <html>, so sticky side panels sit below it and
 * anchors and focused elements scroll clear of it. The header wraps onto a second row at large text sizes.
 */
export function useHeaderHeight(header: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = header.current
    if (!element) return
    const publish = () => document.documentElement.style.setProperty('--header-height', `${element.offsetHeight}px`)
    publish()
    const observer = new ResizeObserver(publish)
    observer.observe(element)
    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--header-height')
    }
  }, [header])
}
