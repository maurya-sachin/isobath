// Browser store for the analytics consent prompt. PostHog keeps the visitor's choice itself; this only tells React
// when the prompt is open. Browser-only: it imports posthog-js, so Node tests never load it.

import posthog from 'posthog-js'
import { useSyncExternalStore } from 'react'
import { analyticsEnabled } from './analytics.ts'

const listeners = new Set<() => void>()
let reopened = false

const CHOICE_KEY_PREFIX = '__ph_opt_in_out_'

/** PostHog keeps the choice in local storage, so a choice made in another tab arrives as a `storage` event. */
function onStorage(event: StorageEvent): void {
  if (event.key?.startsWith(CHOICE_KEY_PREFIX)) notify()
}

function notify(): void {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function setReopened(next: boolean): void {
  reopened = next
  notify()
}

function isPromptOpen(): boolean {
  if (!analyticsEnabled) return false
  return reopened || posthog.get_explicit_consent_status() === 'pending'
}

/** True while the visitor has not chosen yet, or has asked to change their choice. False on the server. */
export function useConsentPromptOpen(): boolean {
  return useSyncExternalStore(subscribe, isPromptOpen, () => false)
}

export function chooseConsent(granted: boolean): void {
  if (granted) posthog.opt_in_capturing()
  else posthog.opt_out_capturing()
  setReopened(false)
}

export function reopenConsent(): void {
  setReopened(true)
}
