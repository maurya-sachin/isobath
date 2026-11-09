import { Search } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useNavigate } from 'react-router'
import { ComingSoon } from '@/components/PageShell'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { track } from '@/analytics/analytics'
import { searchComplete } from '@/analytics/analyticsEvents'
import { loadSearchEngine, type SearchEngine } from '@/questions/search'

type Results = ReturnType<SearchEngine['search']>

/** Toggles the dialog on Ctrl/⌘ + K. */
function useToggleOnShortcut(toggle: () => void) {
  const onShortcut = useEffectEvent(toggle)
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        onShortcut()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])
}

interface SearchResultsProps {
  failed: boolean
  /** The trimmed query. */
  query: string
  /** Whether the search index has loaded. */
  ready: boolean
  results: Results
  onSelect: (id: string) => void
}

function SearchResults({ failed, query, ready, results, onSelect }: SearchResultsProps) {
  if (failed) return <p className="py-6 text-center text-sm">Search is unavailable. Run npm run content:build.</p>
  if (!query) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Type to search titles, tags, and summaries.</p>
  }
  return (
    <>
      {ready && <CommandEmpty>No questions match “{query}”.</CommandEmpty>}
      {results.length > 0 && (
        <CommandGroup>
          {results.map((doc) => (
            <CommandItem key={doc.id} value={doc.id} onSelect={() => onSelect(doc.id)}>
              <div className="flex min-w-0 flex-col">
                <span className="truncate">{doc.title}</span>
                <span className="text-xs text-muted-foreground">
                  {doc.topic} · {doc.chapter}
                </span>
              </div>
              {!doc.hasPage && (
                <span className="ml-auto">
                  <ComingSoon />
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  )
}

export function SearchDialog() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [engine, setEngine] = useState<SearchEngine>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open) return
    loadSearchEngine().then(setEngine, () => setFailed(true))
  }, [open])

  const trimmed = query.trim()
  const results = engine && trimmed ? engine.search(trimmed) : []

  /** Every close goes through here, so a search is counted once whether it was picked from or dismissed. */
  function close(selectedId: string | null = null) {
    // Without the engine every query would look like zero results, a false content gap.
    if (engine) {
      const rankIndex = selectedId === null ? null : results.findIndex((doc) => doc.id === selectedId)
      track(searchComplete({ query, results: results.length, selectedId, rankIndex }))
    }
    setOpen(false)
    setQuery('')
  }

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) setOpen(true)
    else close()
  }

  useToggleOnShortcut(() => handleOpenChange(!open))

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className="w-9 px-0 sm:w-64 sm:justify-start sm:px-2.5 md:w-40 lg:w-64"
      >
        <Search />
        {/* The visible words are the button's name (WCAG 2.5.3); under sm they are for screen readers only. */}
        <span className="sr-only flex-1 text-left text-muted-foreground sm:not-sr-only">Search questions</span>
        <kbd className="hidden rounded border px-1.5 font-mono text-xs lg:inline">⌘K</kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Search questions"
        description="Find a question by title, tag, or summary."
      >
        {/* MiniSearch ranks the results, so cmdk's own filtering is off. */}
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search questions…" />
          <CommandList>
            <SearchResults
              failed={failed}
              query={trimmed}
              ready={Boolean(engine)}
              results={results}
              onSelect={(id) => {
                close(id)
                void navigate(`/${id}`)
              }}
            />
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
