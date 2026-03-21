# Rover

AI-curated daily tech article digest. An external pipeline fetches RSS/Twitter feeds, scores articles with AI, and writes results to Postgres. This app is the **read-only frontend** that displays daily digests.

## Tech Stack

- **Framework**: [Astro 6](https://astro.build) with `@astrojs/vercel` adapter
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) (OKLch color system, light/dark via `prefers-color-scheme`)
- **Database**: [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- **Search**: Semantic search via [Gemini](https://ai.google.dev) embeddings + pgvector
- **i18n**: `zh-CN` (default) / `en`
- **Code quality**: [Biome](https://biomejs.dev) + husky + lint-staged

## Getting Started

```bash
bun install
cp .env.example .env  # configure your environment variables
bun dev
```

Open [http://localhost:4321](http://localhost:4321).

## Commands

```bash
bun dev              # Start dev server
bun build            # Production build
bun preview          # Preview production build
bun run check        # Lint and format with Biome
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run Drizzle migrations
bun run db:studio    # Open Drizzle Studio
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key for semantic search |
| `CRON_SECRET` | Yes | Bearer token for revalidation endpoint |
| `DEPLOY_HOOK_URL` | No | Vercel deploy hook URL |

## License

MIT
