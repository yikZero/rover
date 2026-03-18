import { cn } from '@/lib/utils'

interface ScoreBadgeProps {
  rank: number
  total: string
}

export function ScoreBadge({ rank, total }: ScoreBadgeProps) {
  const isTop = rank <= 3

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold text-xs',
        isTop
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {total}
    </div>
  )
}
