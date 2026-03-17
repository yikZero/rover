import { ScoreBadge } from '@/components/score-badge'

export interface DigestArticle {
  rank: number
  title: string
  url: string
  summary: string
  feedTitle: string
  total: number
  infoDensity: number
  popularity: number
  practicality: number
}

export function DigestCard({ article }: { article: DigestArticle }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span className="font-medium">#{article.rank}</span>
          <span>&middot;</span>
          <span>{article.feedTitle}</span>
        </div>
        <ScoreBadge
          total={article.total}
          infoDensity={article.infoDensity}
          popularity={article.popularity}
          practicality={article.practicality}
        />
      </div>
      <h3 className="mb-2 font-semibold leading-snug">{article.title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {article.summary}
      </p>
    </a>
  )
}
