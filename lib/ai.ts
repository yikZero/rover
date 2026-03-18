import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'

const model = google('gemini-3.1-flash-lite-preview')

const scoringSchema = z.object({
  scores: z.array(
    z.object({
      article_id: z.number(),
      info_density: z.number().min(0).max(100),
      popularity: z.number().min(0).max(100),
      practicality: z.number().min(0).max(100),
    }),
  ),
})

const summarySchema = z.object({
  summary: z.string(),
})

export interface ArticleForScoring {
  id: number
  title: string
  content: string | null
}

export interface ArticleScore {
  articleId: number
  infoDensity: number
  popularity: number
  practicality: number
  total: number
}

export async function scoreArticles(
  articles: ArticleForScoring[],
): Promise<ArticleScore[]> {
  const articlesJson = articles
    .map((a) => `[ID: ${a.id}] ${a.title}\n${a.content ?? ''}`)
    .join('\n---\n')

  const { output } = await generateText({
    model,
    output: Output.object({ schema: scoringSchema }),
    prompt: `You are a strict tech article quality reviewer. Be critical — most articles are average.

Rate each article on three dimensions (0-100):

1. info_density: depth of technical insight or novel information
   - 80-100: original research, deep technical analysis, or reveals non-obvious internals
   - 50-79: solid explanation of known topics with some new angles
   - 20-49: surface-level overview, rehash of docs, or mostly opinions without evidence
   - 0-19: clickbait, fluff, or marketing disguised as content

2. popularity: community relevance and timeliness
   - 80-100: actively trending topic, major release, or industry-shifting event
   - 50-79: relevant to a broad developer audience, timely but not breaking
   - 20-49: niche interest, limited audience, or topic is no longer timely
   - 0-19: outdated or irrelevant to most developers

3. practicality: how directly applicable to real-world work
   - 80-100: reader can apply insights immediately, includes actionable patterns or code
   - 50-79: useful background knowledge that informs decisions
   - 20-49: theoretical or academic, limited practical application
   - 0-19: purely speculative or entertainment

Calibration: expect most articles to score 40-65 per dimension. Scores above 80 should be rare (top 10%). Do NOT inflate scores — a 50 is an average, acceptable article.

Articles:
${articlesJson}`,
  })

  if (!output) throw new Error('AI scoring returned no output')

  return output.scores.map((s) => ({
    articleId: s.article_id,
    infoDensity: s.info_density,
    popularity: s.popularity,
    practicality: s.practicality,
    total: Math.round(
      s.info_density * 0.4 + s.popularity * 0.3 + s.practicality * 0.3,
    ),
  }))
}

export async function generateSummary(
  title: string,
  content: string,
): Promise<string> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: summarySchema }),
    prompt: `You are a tech content editor.
Write a Chinese summary for the following article:
- 150-200 characters
- Highlight core insights and key information
- Professional and concise, targeting developers
- Output MUST be in Simplified Chinese
- Typographic rules:
  - Add a space between CJK and Latin/numbers (e.g. "使用 React 构建", "提升了 30% 性能")
  - Use Chinese punctuation throughout (，。、；：「」（）not ,.;:""())
  - Use half-width numbers and English (123 not １２３)
  - Keep technical terms in their original English form (e.g. React, API, WebSocket), do not translate them

Title: ${title}
Content: ${content}`,
  })

  if (!output) throw new Error('AI summary returned no output')

  return output.summary
}
