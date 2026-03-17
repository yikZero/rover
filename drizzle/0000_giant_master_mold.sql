CREATE TABLE "articles" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "articles_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"feed_id" bigint NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"content" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_url_unique" UNIQUE("url")
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
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"article_id" bigint NOT NULL,
	"info_density" smallint NOT NULL,
	"popularity" smallint NOT NULL,
	"practicality" smallint NOT NULL,
	"total" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_feed_id_feeds_id_fk" FOREIGN KEY ("feed_id") REFERENCES "public"."feeds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_articles" ADD CONSTRAINT "digest_articles_digest_id_daily_digests_id_fk" FOREIGN KEY ("digest_id") REFERENCES "public"."daily_digests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_articles" ADD CONSTRAINT "digest_articles_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_feed_id_idx" ON "articles" USING btree ("feed_id");--> statement-breakpoint
CREATE INDEX "articles_published_at_idx" ON "articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "daily_digests_date_idx" ON "daily_digests" USING btree ("date");--> statement-breakpoint
CREATE INDEX "digest_articles_digest_id_idx" ON "digest_articles" USING btree ("digest_id");--> statement-breakpoint
CREATE INDEX "digest_articles_article_id_idx" ON "digest_articles" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "scores_article_id_idx" ON "scores" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "scores_total_idx" ON "scores" USING btree ("total");