export interface DigestArticle {
  rank: number
  titleZh: string
  titleEn: string
  summaryZh: string
  summaryEn: string
  finalScore: string
  url: string
  feedTitle: string
}

export interface DigestWithArticles {
  date: string
  articles: DigestArticle[]
  stats: { fetched: number; scored: number; selected: number }
}
