import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { createBrowserRouter, matchRoutes, RouterProvider } from 'react-router'
import './index.css'
import { routes } from './routes.tsx'

const basename = import.meta.env.BASE_URL

/**
 * Loads the pages the current URL matches before the router is created. A router with an unloaded lazy route
 * starts uninitialized and renders `HydrateFallback`, which would not match the prerendered page.
 */
async function loadMatchedPages() {
  const matches = matchRoutes(routes, window.location, basename) ?? []
  await Promise.all(
    matches.map(async ({ route }) => {
      if (typeof route.lazy !== 'function') return
      Object.assign(route, { ...(await route.lazy()), lazy: undefined })
    }),
  )
}

async function start() {
  await loadMatchedPages()
  const router = createBrowserRouter(routes, { basename })
  const app = (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  )
  const root = document.getElementById('root')!
  // Prerendered pages arrive with markup to hydrate; the dev server and the app shell arrive with only a placeholder comment.
  if (root.firstElementChild) hydrateRoot(root, app)
  else createRoot(root).render(app)
}

void start()
