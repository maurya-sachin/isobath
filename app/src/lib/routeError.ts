import { isRouteErrorResponse } from 'react-router'

export interface RouteErrorView {
  kind: 'offline' | 'not-found' | 'unexpected'
  eyebrow: string
  title: string
  message: string
}

/**
 * What to tell the reader about a failed route. A rejected `fetch` is a `TypeError`, so a network failure and a
 * browser that reports itself offline both read as "offline"; a 404 response is "not found"; the rest is unexpected.
 */
export function describeRouteError(error: unknown, online: boolean): RouteErrorView {
  if (!online || error instanceof TypeError) {
    return {
      kind: 'offline',
      eyebrow: 'Offline',
      title: "You're offline",
      message: "This page needs a connection to load. It reloads by itself when you're back online.",
    }
  }
  if (isRouteErrorResponse(error) && error.status === 404) {
    return {
      kind: 'not-found',
      eyebrow: '404',
      title: 'Page not found',
      message: "This address doesn't match anything here. It may have moved, or the link has a typo.",
    }
  }
  return {
    kind: 'unexpected',
    eyebrow: 'Error',
    title: 'Something went wrong',
    message: "This page didn't load. Reloading usually fixes it.",
  }
}
