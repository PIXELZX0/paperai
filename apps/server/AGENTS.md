# APPS/SERVER KNOWLEDGE BASE

## OVERVIEW

Fastify API package: auth, REST routes, orchestration runtime, SSE-style activity surfaces, and web asset serving.

## STRUCTURE

```text
apps/server/
├── src/index.ts        # boot entrypoint
├── src/app.ts          # Fastify assembly + auth decorators
├── src/config.ts       # env-backed runtime config
├── src/routes/         # route registry + route tests
├── src/services/       # PlatformService + runtime orchestrator
├── src/lib/            # adapter/runtime helpers
└── src/plugins/        # Fastify/plugin-specific glue
```

## WHERE TO LOOK

| Task                           | Location                              | Notes                                              |
| ------------------------------ | ------------------------------------- | -------------------------------------------------- |
| Start or embed server          | `src/index.ts`                        | `startServer()` returns server metadata            |
| Change auth behavior           | `src/app.ts`                          | `authenticate` and `authenticateAgent` decorators  |
| Add/change routes              | `src/routes/index.ts`                 | All API handlers live here                         |
| Change env/config defaults     | `src/config.ts`                       | Host, DB URL, JWT, web origin                      |
| Main business logic            | `src/services/platform-service.ts`    | Huge service; most mutations/read models land here |
| Runtime loop / agent execution | `src/services/runtime.ts`, `src/lib/` | Orchestration plumbing                             |
| Route-level coverage           | `src/routes/index.test.ts`            | Large API test file                                |

## CONVENTIONS

- Keep HTTP schemas sourced from `@paperai/shared`; routes parse payloads with shared schemas, then delegate to `platformService`.
- Auth is decorator-based on the Fastify app, not standalone middleware folders.
- `src/routes/index.ts` is intentionally centralized; follow existing route style before splitting files.
- Package scripts: `pnpm --filter @paperai/server dev|build|typecheck`.

## ANTI-PATTERNS

- Do not reimplement request validation locally when a shared schema already exists.
- Do not bypass `platformService` from route handlers for domain mutations.
- Do not assume bearer auth always means JWT; local API-key fallback exists in `src/app.ts`.

## NOTES

- `src/app.ts` also serves the built web app for SPA fallback routes.
- `src/services/platform-service.ts` is the main complexity hotspot; search there first for existing behavior.
