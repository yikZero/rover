import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  numeric,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config) {
    return `vector(${(config as { dimensions?: number })?.dimensions ?? 768})`
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number)
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`
  },
})

export const feeds = pgTable(
  'feeds',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    title: text().notNull(),
    url: text().notNull().unique(),
    siteUrl: text('site_url'),
    type: text().notNull(),
    tags: text().array(),
    isActive: boolean('is_active').notNull().default(true),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    errorCount: smallint('error_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('feeds_type_check', sql`${table.type} IN ('rss', 'twitter')`),
  ],
)

export const articles = pgTable(
  'articles',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    feedId: bigint('feed_id', { mode: 'number' })
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    url: text().notNull().unique(),
    content: text(),
    language: text(),
    filterStatus: text('filter_status').notNull().default('pending'),
    clusterId: text('cluster_id'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'articles_filter_status_check',
      sql`${table.filterStatus} IN ('pending', 'passed', 'filtered', 'duplicate')`,
    ),
    index('articles_feed_id_idx').on(table.feedId),
    index('articles_published_at_idx').on(table.publishedAt),
    index('articles_pending_score_idx')
      .on(table.createdAt)
      .where(sql`filter_status = 'passed'`),
  ],
)

export const scores = pgTable(
  'scores',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => articles.id, { onDelete: 'cascade' }),
    scale: numeric({ precision: 3, scale: 1 }).notNull(),
    impact: numeric({ precision: 3, scale: 1 }).notNull(),
    novelty: numeric({ precision: 3, scale: 1 }).notNull(),
    potential: numeric({ precision: 3, scale: 1 }).notNull(),
    legacy: numeric({ precision: 3, scale: 1 }).notNull(),
    positivity: numeric({ precision: 3, scale: 1 }).notNull(),
    credibility: numeric({ precision: 3, scale: 1 }).notNull(),
    relevance: numeric({ precision: 3, scale: 1 }).notNull().default('5.0'),
    total: numeric({ precision: 3, scale: 1 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'scores_scale_check',
      sql`${table.scale} >= 0 AND ${table.scale} <= 10`,
    ),
    check(
      'scores_impact_check',
      sql`${table.impact} >= 0 AND ${table.impact} <= 10`,
    ),
    check(
      'scores_novelty_check',
      sql`${table.novelty} >= 0 AND ${table.novelty} <= 10`,
    ),
    check(
      'scores_potential_check',
      sql`${table.potential} >= 0 AND ${table.potential} <= 10`,
    ),
    check(
      'scores_legacy_check',
      sql`${table.legacy} >= 0 AND ${table.legacy} <= 10`,
    ),
    check(
      'scores_positivity_check',
      sql`${table.positivity} >= 0 AND ${table.positivity} <= 10`,
    ),
    check(
      'scores_credibility_check',
      sql`${table.credibility} >= 0 AND ${table.credibility} <= 10`,
    ),
    check(
      'scores_relevance_check',
      sql`${table.relevance} >= 0 AND ${table.relevance} <= 10`,
    ),
    check(
      'scores_total_check',
      sql`${table.total} >= 0 AND ${table.total} <= 10`,
    ),
    index('scores_total_idx').on(table.total),
  ],
)

export const dailyDigests = pgTable('daily_digests', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  date: date().notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const digestArticles = pgTable(
  'digest_articles',
  {
    digestId: bigint('digest_id', { mode: 'number' })
      .notNull()
      .references(() => dailyDigests.id, { onDelete: 'cascade' }),
    articleId: bigint('article_id', { mode: 'number' })
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    rank: smallint().notNull(),
    titleZh: text('title_zh').notNull(),
    titleEn: text('title_en').notNull(),
    summaryZh: text('summary_zh').notNull(),
    summaryEn: text('summary_en').notNull(),
    finalScore: numeric('final_score', { precision: 4, scale: 1 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.articleId] }),
    index('digest_articles_article_id_idx').on(table.articleId),
  ],
)

export const articleEmbeddings = pgTable('article_embeddings', {
  articleId: bigint('article_id', { mode: 'number' })
    .primaryKey()
    .references(() => articles.id, { onDelete: 'cascade' }),
  embedding: vector({ dimensions: 768 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const telegramLogs = pgTable(
  'telegram_logs',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    digestId: bigint('digest_id', { mode: 'number' })
      .notNull()
      .references(() => dailyDigests.id),
    messageId: text('message_id'),
    status: text().notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'telegram_logs_status_check',
      sql`${table.status} IN ('sent', 'failed')`,
    ),
    index('telegram_logs_digest_id_idx').on(table.digestId),
  ],
)
