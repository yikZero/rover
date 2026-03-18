import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10000,
})

export interface ParsedFeed {
  title: string
  siteUrl: string | undefined
  items: ParsedItem[]
}

export interface ParsedItem {
  title: string
  url: string
  content: string
  publishedAt: Date | undefined
}

function cleanTitle(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[★☆✦✧]/g, '')
    .replace(/⭐︎/g, '')
    .trim()
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(url)

  return {
    title: feed.title ?? url,
    siteUrl: feed.link,
    items: (feed.items ?? [])
      .filter((item) => item.link)
      .map((item) => ({
        title: cleanTitle(item.title ?? 'Untitled'),
        url: item.link as string,
        content: item.contentSnippet ?? item.content ?? '',
        publishedAt: item.isoDate ? new Date(item.isoDate) : undefined,
      })),
  }
}
