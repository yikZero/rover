'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  rank: number
  total: number
  infoDensity: number
  popularity: number
  practicality: number
}

export function ScoreBadge({
  rank,
  total,
  infoDensity,
  popularity,
  practicality,
}: ScoreBadgeProps) {
  const [expanded, setExpanded] = useState(false)
  const isTop = rank <= 3

  return (
    <div
      className="relative"
      role="status"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs transition-colors',
          isTop
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {total}
      </div>
      {expanded && (
        <div className="absolute top-full right-0 z-10 mt-1 flex gap-2 rounded-md border bg-popover px-3 py-2 text-popover-foreground text-xs shadow-md">
          <span>
            <span className="text-muted-foreground">密度</span> {infoDensity}
          </span>
          <span>
            <span className="text-muted-foreground">热度</span> {popularity}
          </span>
          <span>
            <span className="text-muted-foreground">实用</span> {practicality}
          </span>
        </div>
      )}
    </div>
  )
}
