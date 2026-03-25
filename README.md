# PaperAI

PaperAI is a self-hosted TypeScript control plane for zero-human companies.

## Workspace

- `apps/server`: Fastify API, SSE stream, orchestration worker
- `apps/web`: React operator console
- `apps/cli`: CLI for local operator workflows
- `packages/shared`: public domain contracts and validators
- `packages/core`: orchestration, RBAC, budgets, audit helpers
- `packages/db`: Drizzle schema and database client
- `packages/company-package`: markdown-native company import/export
- `packages/plugin-sdk`: plugin manifest validation
- `packages/adapter-sdk`: adapter contracts and execution helpers
- `packages/adapters/*`: concrete local and HTTP adapters

## Quickstart

1. Install dependencies with `pnpm install`
2. Copy `.env.example` to `.env`
3. Start Postgres locally
4. Run `pnpm db:push`
5. Run `pnpm dev`
