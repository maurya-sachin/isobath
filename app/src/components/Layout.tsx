import { useRef } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { AppearanceMenu } from '@/components/AppearanceMenu'
import { ConsentBanner, CookieSettingsButton } from '@/components/ConsentBanner'
import { SearchDialog } from '@/components/SearchDialog'
import { ThemeToggle } from '@/components/ThemeToggle'
import { TopicSwitcher } from '@/components/TopicSwitcher'
import { Wordmark } from '@/components/Wordmark'
import { useHeaderHeight } from '@/lib/useHeaderHeight'
import { REPO_URL } from '@/lib/repo'
import { AUTHOR, AUTHOR_URL, SITE_NAME } from '@/lib/site'
import { cn } from '@/lib/utils'

const MAIN_LINKS = [
  { to: '/paths', label: 'Paths' },
  { to: '/practice', label: 'Practice' },
  { to: '/roadmap', label: 'Roadmap' },
]

export function Layout() {
  const header = useRef<HTMLElement>(null)
  useHeaderHeight(header)
  return (
    <>
      <a
        href="#main"
        className="sr-only print:hidden focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>
      <header
        ref={header}
        className="sticky top-0 z-40 flex print:hidden flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/85 px-6 py-3 backdrop-blur"
      >
        <div className="flex items-baseline gap-2.5">
          <Link to="/" className="text-foreground">
            <Wordmark className="text-xl" />
          </Link>
          <a
            href={AUTHOR_URL}
            className="hidden text-xs whitespace-nowrap text-muted-foreground hover:text-foreground lg:inline"
          >
            by {AUTHOR}
          </a>
        </div>
        <div className="flex items-center gap-1">
          <TopicSwitcher />
          <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
            {MAIN_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 hover:text-foreground',
                    isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <SearchDialog />
          <AppearanceMenu />
          <ThemeToggle />
        </div>
      </header>
      <Outlet />
      <footer className="mt-16 flex print:hidden flex-wrap items-center gap-x-4 gap-y-1 border-t px-6 py-6 text-sm text-muted-foreground">
        <span>
          {SITE_NAME}, by{' '}
          <a href={AUTHOR_URL} className="text-link hover:text-link-hover">
            {AUTHOR}
          </a>
        </span>
        <Link to="/changelog" className="text-link hover:text-link-hover">
          Changelog
        </Link>
        <a href={REPO_URL} className="text-link hover:text-link-hover">
          GitHub
        </a>
        <Link to="/privacy" className="text-link hover:text-link-hover">
          Privacy
        </Link>
        <CookieSettingsButton />
      </footer>
      <ConsentBanner />
      <ScrollRestoration />
    </>
  )
}
