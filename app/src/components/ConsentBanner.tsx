import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { analyticsEnabled } from '@/lib/analytics'
import { chooseConsent, reopenConsent, useConsentPromptOpen } from '@/lib/consentStore'
import { useHydrated } from '@/lib/useHydrated'

const COOKIE_SETTINGS_ID = 'cookie-settings'

/**
 * Asks once whether analytics may use cookies. A non-modal region: focus is never trapped and the page behind stays
 * usable. Decline and Accept share one style so neither is nudged. The first-visit prompt never takes focus; one the
 * visitor reopened from the footer does, and hands focus back to the footer button when they choose.
 */
export function ConsentBanner() {
  const hydrated = useHydrated()
  const open = useConsentPromptOpen()
  const heading = useRef<HTMLHeadingElement>(null)
  const reopenedFromFooter = useRef(false)

  useEffect(() => {
    reopenedFromFooter.current = open && document.activeElement?.id === COOKIE_SETTINGS_ID
    if (reopenedFromFooter.current) heading.current?.focus()
  }, [open])

  function choose(granted: boolean) {
    chooseConsent(granted)
    if (reopenedFromFooter.current) document.getElementById(COOKIE_SETTINGS_ID)?.focus()
  }

  if (!hydrated || !open) return null
  return (
    <section
      aria-labelledby="consent-title"
      className="fixed inset-x-2 bottom-2 z-40 max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-xl border bg-card p-4 text-card-foreground shadow-lg print:hidden md:inset-x-auto md:bottom-4 md:left-4 md:w-95"
    >
      <h2 id="consent-title" ref={heading} tabIndex={-1} className="text-sm font-semibold">
        Anonymous analytics
      </h2>
      <p className="mt-1 mb-3.5 text-sm text-muted-foreground">
        Accept to let us recognise returning visitors and see where readers come from. If you decline, your visit is
        still counted, with no cookies and nothing stored on your device.{' '}
        <Link to="/privacy" className="text-link hover:text-link-hover underline underline-offset-2">
          Privacy
        </Link>
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => choose(false)} className="h-10 flex-1 border-input">
          Decline
        </Button>
        <Button variant="outline" onClick={() => choose(true)} className="h-10 flex-1 border-input">
          Accept
        </Button>
      </div>
    </section>
  )
}

/** The footer entry that reopens the prompt. Absent without analytics, and before hydration, when it could do nothing. */
export function CookieSettingsButton() {
  const hydrated = useHydrated()
  if (!analyticsEnabled || !hydrated) return null
  return (
    <button
      type="button"
      id={COOKIE_SETTINGS_ID}
      onClick={reopenConsent}
      className="cursor-pointer text-link hover:text-link-hover"
    >
      Cookie settings
    </button>
  )
}
