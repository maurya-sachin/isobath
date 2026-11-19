// Browser store for the analytics consent prompt. PostHog keeps the visitor's choice itself; this only tells React
// when the prompt is open. Browser-only: it reads the analytics client, so Node tests never load it.

import { useSyncExternalStore } from 'react'
import { getAnalytics, onAnalyticsReady } from './analytics.ts'

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
  const stopWaiting = onAnalyticsReady(listener)
  return () => {
    stopWaiting()
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

function setReopened(next: boolean): void {
  reopened = next
  notify()
}

function isPromptOpen(): boolean {
  const analytics = getAnalytics()
  if (!analytics) return false
  return reopened || analytics.get_explicit_consent_status() === 'pending'
}

/** True while the visitor has not chosen yet, or has asked to change their choice. False on the server. */
export function useConsentPromptOpen(): boolean {
  return useSyncExternalStore(subscribe, isPromptOpen, () => false)
}

export function chooseConsent(granted: boolean): void {
  const analytics = getAnalytics()
  if (!analytics) return
  if (granted) analytics.opt_in_capturing()
  else analytics.opt_out_capturing()
  setReopened(false)
}

export function reopenConsent(): void {
  setReopened(true)
}
