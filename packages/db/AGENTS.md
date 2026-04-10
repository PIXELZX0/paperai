# PACKAGES/DB KNOWLEDGE BASE

## OVERVIEW

Database package for Drizzle client wiring, embedded/local DB support, and exported schema surface.

## WHERE TO LOOK

| Task                      | Location                  | Notes                                       |
| ------------------------- | ------------------------- | ------------------------------------------- |
| Public exports            | `src/index.ts`            | Re-exports client, embedded helpers, schema |
| DB client setup           | `src/client.ts`           | Main connection entry                       |
| Embedded/local DB support | `src/embedded.ts`         | Local development/runtime helper            |
| Drizzle schema            | `src/schema/index.ts`     | Canonical schema export                     |
| Drizzle config            | `../../drizzle.config.ts` | Points schema to this package               |

## CONVENTIONS

- Package surface stays minimal: client + embedded + schema.
- Root repo owns `db:generate`, `db:push`, `db:studio`; package itself exposes only build/typecheck.
- Package scripts: `pnpm --filter @paperai/db build|typecheck`.

## ANTI-PATTERNS

- Do not duplicate schema exports outside `src/schema/index.ts`.
- Do not bury DB connection logic inside apps when it can live here.

## NOTES

- `drizzle.config.ts` writes generated artifacts under `packages/db/drizzle`.
- `src/repositories/` is currently empty; check whether a new abstraction is warranted before adding one.
