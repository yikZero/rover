import {
  bigint,
  boolean,
  date,
  index,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const feeds = pgTable('feeds', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  title: text().notNull(),
  url: text().notNull().unique(),
  siteUrl: text('site_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

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
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('articles_feed_id_idx').on(table.feedId),
    index('articles_published_at_idx').on(table.publishedAt),
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
    infoDensity: smallint('info_density').notNull(),
    popularity: smallint().notNull(),
    practicality: smallint().notNull(),
    total: smallint().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('scores_article_id_idx').on(table.articleId),
    index('scores_total_idx').on(table.total),
  ],
)

export const dailyDigests = pgTable(
  'daily_digests',
  {
    id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    date: date().notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('daily_digests_date_idx').on(table.date)],
)

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
    summary: text().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.digestId, table.articleId] }),
    index('digest_articles_digest_id_idx').on(table.digestId),
    index('digest_articles_article_id_idx').on(table.articleId),
  ],
)
