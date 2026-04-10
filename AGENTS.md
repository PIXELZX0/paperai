# PROJECT KNOWLEDGE BASE

**Generated:** 2026-04-09
**Commit:** 3eb694a
**Branch:** main

## OVERVIEW

PaperAI is a pnpm TypeScript monorepo for a self-hosted control plane: Fastify API, React operator console, npm-published CLI, shared contracts, DB layer, and adapter packages for local/HTTP agent execution.

## STRUCTURE

```text
paperai/
├── apps/server/        # Fastify API, auth, orchestration, runtime, SSE
├── apps/web/           # React console, router, react-query driven admin UI
├── apps/cli/           # papercli / paperai CLI entrypoint and command registry
├── packages/shared/    # canonical contracts, schemas, config and API types
├── packages/core/      # domain helpers: RBAC, budgets, context, audit, task rules
├── packages/db/        # Drizzle client + embedded/local DB helpers
├── packages/adapters/  # adapter implementations wrapping SDK/local/http executors
├── packages/*-sdk/     # adapter and plugin helper packages
├── packages/company-package/ # markdown import/export for company snapshots
├── docs/               # deploy + API docs, adapter notes
├── scripts/            # release smoke and operating eval scripts
└── skills/             # reusable runtime skills shipped with the repo
```

## WHERE TO LOOK

| Task                                       | Location                                                                | Notes                                 |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------- |
| Start API / boot server                    | `apps/server/src/index.ts`, `apps/server/src/app.ts`                    | `startServer()` and `createApp()`     |
| Add or inspect HTTP endpoints              | `apps/server/src/routes/index.ts`                                       | Large single route registry           |
| Business logic / persistence orchestration | `apps/server/src/services/platform-service.ts`                          | Main service hotspot                  |
| Web routing and session shell              | `apps/web/src/app.tsx`, `apps/web/src/routes/`                          | Router + large dashboard page         |
| CLI command wiring                         | `apps/cli/src/index.ts`, `apps/cli/src/commands/`                       | Commander-based registry              |
| Shared request/response contracts          | `packages/shared/src/types.ts`, `packages/shared/src/schemas.ts`        | Canonical API surface                 |
| Domain helpers and rules                   | `packages/core/src/`                                                    | Budgets, RBAC, tasks, audit           |
| DB client / schema                         | `packages/db/src/`                                                      | `client.ts`, `embedded.ts`, `schema/` |
| Adapter execution model                    | `packages/adapter-sdk/src/index.ts`, `packages/adapters/*/src/index.ts` | Shared SDK + concrete adapters        |
| Company package import/export              | `packages/company-package/src/index.ts`                                 | Markdown-native package translation   |

## CODE MAP

| Symbol                                     | Type            | Location                                       | Role                                                  |
| ------------------------------------------ | --------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `startServer`                              | function        | `apps/server/src/index.ts`                     | API entrypoint                                        |
| `createApp`                                | function        | `apps/server/src/app.ts`                       | Fastify assembly, auth decorators, static web serving |
| `routes`                                   | Fastify plugin  | `apps/server/src/routes/index.ts`              | All REST endpoints                                    |
| `PlatformService`                          | class           | `apps/server/src/services/platform-service.ts` | Core application/service layer                        |
| `App`                                      | React component | `apps/web/src/app.tsx`                         | Browser router root                                   |
| `DashboardPage`                            | React component | `apps/web/src/routes/dashboard-page.tsx`       | Main operator console hotspot                         |
| `buildProgram` / `runCli`                  | functions       | `apps/cli/src/index.ts`                        | CLI registry + execution                              |
| `AdapterExecutionContext`                  | interface       | `packages/shared/src/types.ts`                 | Adapter contract boundary                             |
| `parseCompanyPackage`                      | function        | `packages/company-package/src/index.ts`        | Markdown package importer                             |
| `createLocalAdapter` / `createHttpAdapter` | functions       | `packages/adapter-sdk/src/index.ts`            | Adapter implementation primitives                     |

## CONVENTIONS

- Workspace layout is intentional: `apps/*`, `packages/*`, `packages/adapters/*` via `pnpm-workspace.yaml`.
- Root dev loop runs only server + web: `pnpm dev` filters `@paperai/server` and `@paperai/web`.
- Package public surfaces usually export from `src/index.ts`; app packages expose `src/index.ts` through `package.json` exports when needed.
- TypeScript is strict from `tsconfig.base.json`; Node 22 is the baseline.
- Library packages build with `tsup src/index.ts --format esm --dts`; app packages use package-local tsup or Vite.
- Unit tests use Vitest with `**/*.test.ts`; browser E2E lives in `apps/web/e2e` via Playwright.
- Formatting is Prettier defaulting to semicolons, double quotes, trailing commas.

## ANTI-PATTERNS (THIS PROJECT)

- No explicit repo-wide `DO NOT` / `NEVER` comment ledger was found during scan.
- Avoid assuming route files are small: `apps/server/src/routes/index.ts` is the canonical but very large API registry.
- Avoid duplicating shared domain contracts outside `packages/shared`; that package is the source of truth.
- Avoid treating adapters as bespoke apps: most concrete adapters are thin wrappers over `adapter-sdk` or `adapter-local-process`.

## UNIQUE STYLES

- CLI keeps dual invocation names: `papercli` preferred, `paperai` retained as compatibility alias.
- Server auth accepts JWT plus API-key-style bearer/header flows; auth behavior lives in `createApp()` decorators, not a separate middleware folder.
- The web app consolidates most operator UX in `dashboard-page.tsx` rather than many tiny route modules.
- CI and Docker release workflows auto-open GitHub issues on failure instead of only failing silently.

## COMMANDS

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm db:push
pnpm smoke:release:local
pnpm eval:operating
```

## NOTES

- No existing `AGENTS.md` or repo-local `CLAUDE.md` files were present before this run.
- `apps/server/src/config.ts` ships permissive local defaults (`127.0.0.1:3001`, local Postgres, `jwtSecret="change-me"`). Fine for local dev, not for production assumptions.
- `apps/server/src/app.ts` serves `apps/web/dist` when present; API + UI share one production container.
- `packages/shared/src/types.ts` and `apps/server/src/services/platform-service.ts` are the biggest knowledge hotspots.
- Background explore agents failed during generation because subagent auth was unavailable; this file was generated from direct repo analysis.
