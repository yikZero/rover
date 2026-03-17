# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun dev              # Start dev server (Turbopack)
bun build            # Production build
bun start            # Start production server
bun run check        # Lint and format with Biome
bun run db:generate  # Generate Drizzle migrations
bun run db:migrate   # Run Drizzle migrations
bun run db:studio    # Open Drizzle Studio (DB browser)
```

## Architecture

Next.js 16 App Router project (React 19) scaffolded from [create-rotor](https://github.com/yikzero/rotor).

- **Styling**: Tailwind CSS v4 — CSS-first config in `app/globals.css` (OKLch color system, light/dark themes), no `tailwind.config`
- **UI Components**: shadcn/ui (configured in `components.json`, style "base-maia") — add with `bunx shadcn add <component>`
- **Database**: Drizzle ORM + PostgreSQL (`postgres` driver). Schema in `lib/schema.ts`, client in `lib/db.ts`, config in `drizzle.config.ts`
- **AI**: Vercel AI SDK (`ai`) with Google Gemini provider (`@ai-sdk/google`) — see `lib/ai.ts`
- **Data fetching**: SWR with generic fetcher in `lib/fetcher.ts`
- **Code quality**: Biome (lint + format), pre-commit hook via husky + lint-staged
- **Path alias**: `@/*` maps to project root
- **MCP**: next-devtools-mcp configured in `.mcp.json` for AI agent integration

## Key Directories

- `app/` — Routes, layouts, pages, API routes
- `lib/` — Utilities (`utils.ts` for `cn()`, `fetcher.ts`), database client, schema, AI helpers
- `components/` — React components (shadcn/ui goes in `components/ui/`)

## Code Style (Biome)

- Single quotes, no semicolons, trailing commas, 2-space indent
- File names must be `kebab-case`
- No unused imports/parameters, no barrel files, no `any`
- Tailwind classes are auto-sorted (in `cn`, `clsx`, `cva` calls too)
- Prefer `import type` / `export type` for type-only imports

## Environment Variables

Requires: `DATABASE_URL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `CRON_SECRET`, `ADMIN_PASSWORD` (see `.env.example`)
