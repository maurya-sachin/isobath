// Browser store for the analytics consent prompt. PostHog keeps the visitor's choice itself; this only tells React
// when the prompt is open. Browser-only: it imports posthog-js, so Node tests never load it.

import posthog from 'posthog-js'
import { useSyncExternalStore } from 'react'
import { analyticsEnabled } from './analytics.ts'

const listeners = new Set<() => void>()
let reopened = false

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setReopened(next: boolean): void {
  reopened = next
  for (const listener of listeners) listener()
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
