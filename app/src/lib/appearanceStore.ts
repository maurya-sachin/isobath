// Browser store for the appearance settings. Pure parts live in appearance.ts so Node tests never load DOM code.
// The inline script in index.html applies the saved settings before first paint; this keeps <html> in sync afterwards.

import { useSyncExternalStore } from 'react'
import {
  APPEARANCE_KEY,
  DEFAULT_APPEARANCE,
  parseAppearance,
  rootSettings,
  serializeAppearance,
  type Appearance,
} from './appearance'

const listeners = new Set<() => void>()
let current: Appearance | undefined

function snapshot(): Appearance {
  if (current) return current
  let raw: string | null = null
  try {
    raw = localStorage.getItem(APPEARANCE_KEY)
  } catch {
    // Storage can be blocked (private mode, disabled cookies): the defaults apply.
  }
  current = parseAppearance(raw)
  return current
}

function applyToRoot(appearance: Appearance): void {
  const root = document.documentElement
  const { properties, attributes, fontSize } = rootSettings(appearance)
  for (const [name, value] of Object.entries(properties)) {
    if (value === null) root.style.removeProperty(name)
    else root.style.setProperty(name, value)
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) root.removeAttribute(name)
    else root.setAttribute(name, value)
  }
  root.style.fontSize = fontSize ?? ''
}

export function setAppearance(next: Appearance): void {
  current = next
  try {
    const saved = serializeAppearance(next)
    if (saved === null) localStorage.removeItem(APPEARANCE_KEY)
    else localStorage.setItem(APPEARANCE_KEY, saved)
  } catch {
    // The choice still applies for this visit.
  }
  applyToRoot(next)
  listeners.forEach((listener) => listener())
}

export const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE)

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The saved settings; the defaults while rendering on the server. */
export function useAppearance(): Appearance {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_APPEARANCE)
}
