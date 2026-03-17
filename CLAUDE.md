# rover

## Commands

```bash
bun dev       # Start dev server (Turbopack)
bun build     # Production build
bun start     # Start production server
bun run check # Lint and format with Biome
```

## Architecture

Next.js App Router project.

- **Styling**: Tailwind CSS v4 — CSS-first config in `app/globals.css`, no `tailwind.config`
- **Code quality**: Biome (lint + format), pre-commit hook via husky + lint-staged
- **Path alias**: `@/*` maps to project root

## Key Directories

- `app/` — Routes, layouts, pages, API routes
- `lib/` — Utilities, database client, shared logic
- `components/` — React components

## Code Style (Biome)

- Single quotes, no semicolons, trailing commas
- File names must be `kebab-case`
- No unused imports/parameters, no barrel files, no `any`
- Tailwind classes are auto-sorted (in `cn`, `clsx`, `cva` calls too)
- Prefer `import type` / `export type` for type-only imports

## Recommended Skills

```bash
claude skill install vercel-labs/next-skills/next-best-practices       # Next.js best practices
claude skill install vercel-labs/agent-skills/react-best-practices      # React performance optimization
```
