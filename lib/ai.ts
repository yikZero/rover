import { google } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'

const model = google('gemini-2.5-flash')

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
    prompt: `You are a tech article quality reviewer.
Rate each article on three dimensions (0-100):
1. info_density: substantial technical insights or new knowledge, not fluff
2. popularity: hot topic in the community or influential in the industry
3. practicality: directly applicable to real-world work

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

Title: ${title}
Content: ${content}`,
  })

  if (!output) throw new Error('AI summary returned no output')

  return output.summary
}
