// Browser store for "Don't count my visits on this device". Kept apart from analytics.ts so that module can read it
// without a cycle. While it is on, PostHog is never loaded on this device (and events already queued are dropped).

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'isobath:analytics'
const OFF = 'off'

const listeners = new Set<() => void>()
let current: boolean | undefined

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === OFF
  } catch {
    return false // storage can be blocked (private mode, disabled cookies)
  }
}

/** True when this device has asked not to be counted. */
export function deviceOptedOut(): boolean {
  current ??= readStored()
  return current
}

function notify(): void {
  for (const listener of listeners) listener()
}

export function setDeviceOptOut(off: boolean): void {
  current = off
  try {
    if (off) localStorage.setItem(STORAGE_KEY, OFF)
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // The choice still applies for this visit.
  }
  notify()
}

/** A change made in another tab arrives as a `storage` event. */
function onStorage(event: StorageEvent): void {
  if (event.key !== STORAGE_KEY) return
  current = undefined
  notify()
}

/** Calls `listener` whenever the choice changes. Returns the unsubscribe function. */
export function subscribeDeviceOptOut(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener('storage', onStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', onStorage)
  }
}

/** False while rendering on the server. */
export function useDeviceOptOut(): boolean {
  return useSyncExternalStore(subscribeDeviceOptOut, deviceOptedOut, () => false)
}
