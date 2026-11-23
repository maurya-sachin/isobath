import { coverRings, ringPath } from '@/geometry/contours'
import { depthStrokeClass } from '@/geometry/depth'
import { cn } from '@/lib/utils'

interface TopicCoverProps {
  slug: string
  chapterCount: number
  /** Share of the topic's questions rated hard, 0 to 1: harder topics get steeper, more crowded rings. */
  hardShare: number
  className?: string
}

/** A topic's cover: a contour map drawn from its slug, one level per chapter. Decorative. A non-square cover crops the map rather than shrinking it. */
export function TopicCover({ slug, chapterCount, hardShare, className }: TopicCoverProps) {
  const { rings, levels } = coverRings(slug, chapterCount, hardShare)
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      strokeWidth="0.8"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn('overflow-hidden', className)}
    >
      {rings.map((ring, index) => (
        <path
          key={index}
          d={ringPath(ring.points)}
          className={cn(depthStrokeClass(ring.level, levels), ring.level === levels - 1 && 'fill-depth-4/20')}
        />
      ))}
    </svg>
  )
}
