ALTER TABLE "digest_articles" DROP COLUMN "summary";
--> statement-breakpoint
ALTER TABLE "digest_articles" ADD COLUMN "title_zh" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "digest_articles" ADD COLUMN "title_en" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "digest_articles" ADD COLUMN "summary_zh" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "digest_articles" ADD COLUMN "summary_en" text NOT NULL;
--> statement-breakpoint
ALTER TABLE "digest_articles" ADD COLUMN "final_score" numeric(4, 1) NOT NULL;
