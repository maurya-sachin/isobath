import { formatMonth } from '@/content/freshness'
import type { Difficulty, Status } from '@/content/types'
import { cn } from '@/lib/utils'

const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: 'bg-easy text-easy-foreground',
  medium: 'bg-medium text-medium-foreground',
  hard: 'bg-hard text-hard-foreground',
}

/** Amber text that keeps 4.5:1 on the page, card and muted surfaces in both themes (checked in palette.test.ts). */
export const WARNING_TEXT = 'text-medium-foreground'

const FREQUENCY_LABEL = ['', 'rarely', 'sometimes', 'often', 'very often', 'almost always']

interface MetaRowProps {
  status: Status
  difficulty: Difficulty
  frequency: number
  verified: string
  stale: boolean
  legacy: string | null
}

export function MetaRow({ status, difficulty, frequency, verified, stale, legacy }: MetaRowProps) {
  return (
    <>
      <ul aria-label="Question details" className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <li>
          <LifecycleLabel status={status} legacy={legacy !== null} />
        </li>
        <li>
          <DifficultyBadge difficulty={difficulty} />
        </li>
        <li className="flex items-center gap-1.5">
          Asked
          <FrequencyDots frequency={frequency} />
          {FREQUENCY_LABEL[frequency]}
        </li>
        <li>
          Verified {formatMonth(verified)}
          {stale && <span className={WARNING_TEXT}> · may be out of date</span>}
        </li>
      </ul>
      {legacy !== null && <p className="mt-3 text-sm text-muted-foreground">Legacy: {legacy}</p>}
    </>
  )
}

const LABEL_STYLE = 'rounded-full border px-2 py-0.5 font-medium'

/** Draft, Reviewed or Legacy; a legacy question is labelled so whatever its status. */
function LifecycleLabel({ status, legacy }: { status: Status; legacy: boolean }) {
  if (legacy) return <span className={cn(LABEL_STYLE, 'border-transparent bg-medium text-medium-foreground')}>Legacy</span>
  if (status === 'published') return <span className={cn(LABEL_STYLE, 'border-link text-link')}>Reviewed</span>
  return <span className={cn(LABEL_STYLE, 'text-muted-foreground')}>Draft</span>
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return <span className={cn('rounded-full px-2 py-0.5 font-medium capitalize', DIFFICULTY_STYLE[difficulty])}>{difficulty}</span>
}

export function FrequencyDots({ frequency }: { frequency: number }) {
  return (
    <span role="img" aria-label={`Asked ${FREQUENCY_LABEL[frequency]} (${frequency} of 5)`} className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((dot) => (
        <span key={dot} className={cn('size-2 rounded-xs', dot <= frequency ? 'bg-foreground' : 'bg-border')} />
      ))}
    </span>
  )
}
