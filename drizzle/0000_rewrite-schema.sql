CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"feed_id" bigint NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content" text,
	"language" text,
	"filter_status" text DEFAULT 'pending' NOT NULL,
	"cluster_id" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url"),
	CONSTRAINT "articles_filter_status_check" CHECK ("articles"."filter_status" IN ('pending', 'passed', 'filtered', 'duplicate'))
);
--> statement-breakpoint
CREATE TABLE "daily_digests" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "daily_digests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_digests_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "digest_articles" (
	"digest_id" bigint NOT NULL,
	"article_id" bigint NOT NULL,
	"rank" smallint NOT NULL,
	"summary" text NOT NULL,
	CONSTRAINT "digest_articles_digest_id_article_id_pk" PRIMARY KEY("digest_id","article_id")
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feeds_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"url" text NOT NULL,
	"site_url" text,
	"type" text NOT NULL,
	"tags" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"error_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_url_unique" UNIQUE("url"),
	CONSTRAINT "feeds_type_check" CHECK ("feeds"."type" IN ('rss', 'twitter'))
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"scale" numeric(3, 1) NOT NULL,
	"impact" numeric(3, 1) NOT NULL,
	"novelty" numeric(3, 1) NOT NULL,
	"potential" numeric(3, 1) NOT NULL,
	"legacy" numeric(3, 1) NOT NULL,
	"positivity" numeric(3, 1) NOT NULL,
	"credibility" numeric(3, 1) NOT NULL,
	"total" numeric(3, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_article_id_unique" UNIQUE("article_id"),
	CONSTRAINT "scores_scale_check" CHECK ("scores"."scale" >= 0 AND "scores"."scale" <= 10),
	CONSTRAINT "scores_impact_check" CHECK ("scores"."impact" >= 0 AND "scores"."impact" <= 10),
	CONSTRAINT "scores_novelty_check" CHECK ("scores"."novelty" >= 0 AND "scores"."novelty" <= 10),
	CONSTRAINT "scores_potential_check" CHECK ("scores"."potential" >= 0 AND "scores"."potential" <= 10),
	CONSTRAINT "scores_legacy_check" CHECK ("scores"."legacy" >= 0 AND "scores"."legacy" <= 10),
	CONSTRAINT "scores_positivity_check" CHECK ("scores"."positivity" >= 0 AND "scores"."positivity" <= 10),
	CONSTRAINT "scores_credibility_check" CHECK ("scores"."credibility" >= 0 AND "scores"."credibility" <= 10),
	CONSTRAINT "scores_total_check" CHECK ("scores"."total" >= 0 AND "scores"."total" <= 10)
);
--> statement-breakpoint
CREATE TABLE "telegram_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "telegram_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"digest_id" bigint NOT NULL,
	"message_id" text,
	"status" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_logs_status_check" CHECK ("telegram_logs"."status" IN ('sent', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_articles" ADD CONSTRAINT "digest_articles_digest_id_daily_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."daily_digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_articles" ADD CONSTRAINT "digest_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_logs" ADD CONSTRAINT "telegram_logs_digest_id_daily_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."daily_digests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_feed_id_idx" ON "articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "articles_pending_score_idx" ON "articles" USING btree ("created_at") WHERE filter_status = 'passed';--> statement-breakpoint
CREATE INDEX "digest_articles_article_id_idx" ON "digest_articles" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "scores_total_idx" ON "scores" USING btree ("total");--> statement-breakpoint
CREATE INDEX "telegram_logs_digest_id_idx" ON "telegram_logs" USING btree ("digest_id");