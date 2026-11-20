// "Suggest a fix", fed by the reader's selection: text selected in the question body is held as a quote, shown in a
// bar at the bottom of the viewport and in the footer, and sent to the correction form in the link's URL.
// Spec: docs/superpowers/specs/2026-11-08-suggest-fix-design.md

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useConsentPromptOpen } from '@/analytics/consentStore'
import { MAX_QUOTE, toQuote, type Quote } from '@/lib/quote'
import { suggestFixUrl } from '@/lib/repo'

interface HeldQuote extends Quote {
  section: string
  sectionId: string
}

/** `selectionchange` fires on every mouse move while dragging; the selection is read once it has been still this long. */
const SETTLE_MS = 300
const QUOTABLE = '[data-quotable]'
const SECTION = 'section[aria-labelledby]'
const LINK = 'inline-flex min-h-6 items-center text-link hover:text-link-hover'

/** The element a selection boundary is in; a text node has no `closest`. */
const elementOf = (node: Node | null): Element | null =>
  node instanceof Element ? node : (node?.parentElement ?? null)

/** Both ends inside the question body; with several ranges (Firefox), the first range's start and the last one's end. */
function bodyRange(selection: Selection): Element | null {
  const start = elementOf(selection.getRangeAt(0).startContainer)
  const end = elementOf(selection.getRangeAt(selection.rangeCount - 1).endContainer)
  return start?.closest(QUOTABLE) && end?.closest(QUOTABLE) ? start : null
}

/** The id of the headed section the selection starts in, when the selection lies within the question body. */
function sectionIdOf(selection: Selection): string | null {
  if (selection.isCollapsed || selection.rangeCount === 0) return null
  return bodyRange(selection)?.closest(SECTION)?.getAttribute('aria-labelledby') ?? null
}

/** The section's heading text ("Answer"), or its id if the heading is missing. */
const sectionName = (sectionId: string) => document.getElementById(sectionId)?.textContent?.trim() || sectionId

/** The quote a selection makes: inside the body, starting in a headed section, not only whitespace. */
function readQuote(selection: Selection | null): HeldQuote | null {
  if (!selection) return null
  // Checked before `toString()`, which for a select-all would be the whole page.
  const sectionId = sectionIdOf(selection)
  const quote = sectionId && toQuote(selection.toString())
  if (!sectionId || !quote) return null
  return { ...quote, section: sectionName(sectionId), sectionId }
}

/** A click or tap in the body that leaves only a caret there: the reader has moved on from the quote. */
const caretInBody = (selection: Selection | null) =>
  Boolean(selection?.isCollapsed && elementOf(selection.anchorNode)?.closest(QUOTABLE))

/** The quote held from the last valid selection. Selections elsewhere (the bar, the nav) leave it as it is. */
function useHeldQuote(): [HeldQuote | null, () => void] {
  const [quote, setQuote] = useState<HeldQuote | null>(null)
  useEffect(() => {
    let timer: number | undefined
    const settle = () => {
      const selection = window.getSelection()
      if (caretInBody(selection)) {
        setQuote(null)
        return
      }
      const next = readQuote(selection)
      // Same text again keeps the same object, so nothing re-renders or is announced twice.
      if (next) setQuote((held) => (held?.text === next.text && held.sectionId === next.sectionId ? held : next))
    }
    const onChange = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(settle, SETTLE_MS)
    }
    document.addEventListener('selectionchange', onChange)
    return () => {
      document.removeEventListener('selectionchange', onChange)
      window.clearTimeout(timer)
    }
  }, [])
  const clear = () => {
    setQuote(null)
    window.getSelection()?.removeAllRanges()
  }
  return [quote, clear]
}

interface SuggestFixProps {
  questionId: string
  title: string
  pageUrl: string
  /** Links shown after "Suggest a fix" on the same line. */
  children: ReactNode
}

/** Keyed by question id where it is used, so a held quote never follows the reader to another question. */
export function SuggestFix({ questionId, title, pageUrl, children }: SuggestFixProps) {
  const [quote, clear] = useHeldQuote()
  // The consent prompt owns the bottom edge until the visitor chooses; the panel above still offers the same link.
  const consentPromptOpen = useConsentPromptOpen()
  const linkRef = useRef<HTMLAnchorElement>(null)
  const href = suggestFixUrl(questionId, title, pageUrl, quote ?? undefined)
  // Focus leaves the bar before it unmounts, without scrolling the reader down to the footer.
  const clearAndReturn = () => {
    clear()
    linkRef.current?.focus({ preventScroll: true })
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') clearAndReturn()
  }

  return (
    <>
      {quote && <QuotePanel quote={quote} onClear={clearAndReturn} onKeyDown={onKeyDown} />}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <a ref={linkRef} href={href} target="_blank" rel="noreferrer" className={LINK}>
          {quote ? 'Suggest a fix for the selected text' : 'Suggest a fix'}
        </a>
        {children}
      </div>
      {quote && !consentPromptOpen && (
        <QuoteBar quote={quote} href={href} onClear={clearAndReturn} onKeyDown={onKeyDown} />
      )}
      <p role="status" className="sr-only">
        {quote ? `Suggest a fix: ${quote.length} characters selected in ${quote.section}.` : ''}
      </p>
    </>
  )
}

interface QuoteViewProps {
  quote: HeldQuote
  onClear: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

function QuoteFacts({ quote }: { quote: HeldQuote }) {
  return (
    <p className="text-xs text-muted-foreground">
      {quote.section} · {quote.length} characters
      {quote.truncated && ` · shortened to the first ${MAX_QUOTE}`}
    </p>
  )
}

/** The full quote above the footer links: the keyboard path, and what will be sent. */
function QuotePanel({ quote, onClear, onKeyDown }: QuoteViewProps) {
  return (
    <div onKeyDown={onKeyDown} className="flex flex-col gap-2 rounded-lg bg-muted p-4">
      <QuoteFacts quote={quote} />
      {/* No inner scroll: a region that scrolls must be keyboard-focusable, and 500 characters stay short. */}
      <blockquote className="font-mono text-xs break-words whitespace-pre-wrap text-foreground">
        {quote.text}
      </blockquote>
      <Button variant="outline" size="sm" onClick={onClear} className="self-start">
        Clear
      </Button>
    </div>
  )
}

/** Fixed to the bottom edge, away from the selection menus phones draw next to the selection. */
function QuoteBar({ quote, href, onClear, onKeyDown }: QuoteViewProps & { href: string }) {
  return (
    <div
      onKeyDown={onKeyDown}
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden"
    >
      <div className="flex max-h-[40vh] w-full max-w-180 flex-wrap items-center gap-x-4 gap-y-2 overflow-y-auto rounded-xl border border-input bg-card px-4 py-3 text-sm shadow-lg">
        <div className="min-w-0 flex-1 basis-60">
          <p className="line-clamp-2 break-words text-foreground">{quote.text}</p>
          <QuoteFacts quote={quote} />
        </div>
        <div className="flex items-center gap-3">
          <a href={href} target="_blank" rel="noreferrer" className={`${LINK} min-h-10 font-medium`}>
            Suggest a fix for this text
          </a>
          <Button variant="outline" onClick={onClear} className="h-10">
            Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
