import { ChevronRight } from 'lucide-react'
import { ScoreBadge } from '@/components/score-badge'
import { Skeleton } from '@/components/ui/skeleton'

export interface DigestArticle {
  rank: number
  titleZh: string
  titleEn: string
  url: string
  summaryZh: string
  summaryEn: string
  feedTitle: string
  finalScore: string
}

export function DigestCardSkeleton() {
  return (
    <div>
      <div
        aria-hidden
        className="h-px bg-[length:4px_1px] bg-repeat-x opacity-20 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)]"
      />
      <div className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
        <div className="grid gap-3 md:grid-cols-[auto_1fr]">
          <Skeleton className="h-5 w-6" />
          <div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mt-2 h-4 w-full" />
            <Skeleton className="mt-1 h-4 w-2/3" />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <Skeleton className="h-5 w-8 rounded-full" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
    </div>
  )
}

export function DigestCard({ article }: { article: DigestArticle }) {
  return (
    <div>
      <div
        aria-hidden
        className="h-px bg-[length:4px_1px] bg-repeat-x opacity-20 [background-image:linear-gradient(90deg,var(--color-foreground)_1px,transparent_1px)]"
      />
      <article className="group relative grid gap-4 py-5 md:grid-cols-[1fr_auto] md:gap-8">
        <div className="grid gap-3 md:grid-cols-[auto_1fr]">
          <span className="text-muted-foreground text-sm tabular-nums md:w-10">
            #{article.rank}
          </span>
          <div>
            <h3 className="font-medium leading-snug">{article.titleZh}</h3>
            <p className="mt-1 line-clamp-2 text-muted-foreground text-sm leading-relaxed">
              {article.summaryZh}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 max-md:justify-between">
          <ScoreBadge rank={article.rank} finalScore={article.finalScore} />
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Read ${article.titleEn}`}
            className="flex items-center gap-1 font-medium text-primary text-sm transition-colors duration-200 before:absolute before:inset-0 hover:text-foreground"
          >
            Read
            <ChevronRight
              strokeWidth={2.5}
              aria-hidden="true"
              className="size-3.5 translate-y-px duration-200 group-hover:translate-x-0.5"
            />
          </a>
        </div>
      </article>
    </div>
  )
}
