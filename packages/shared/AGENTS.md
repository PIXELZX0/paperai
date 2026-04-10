# PACKAGES/SHARED KNOWLEDGE BASE

## OVERVIEW

Canonical shared contracts package: constants, schemas, types, and runtime config shapes used across apps and packages.

## WHERE TO LOOK

| Task                  | Location           | Notes                              |
| --------------------- | ------------------ | ---------------------------------- |
| Public surface        | `src/index.ts`     | Re-exports constants/types/schemas |
| API/domain interfaces | `src/types.ts`     | Largest shared hotspot             |
| Validation schemas    | `src/schemas.ts`   | Zod-backed contracts               |
| Shared constants      | `src/constants.ts` | Common enums/constants             |

## CONVENTIONS

- Cross-package contracts belong here first.
- Types and schemas are exported together; server routes and web/CLI clients consume the same source.
- Package scripts: `pnpm --filter @paperai/shared build|typecheck`.

## ANTI-PATTERNS

- Do not fork request/response shapes into app-local types.
- Do not add server-only or browser-only runtime code here.

## NOTES

- `src/types.ts` is large and central; changing it has wide blast radius.
- `plugin-sdk`, `core`, `server`, `web`, and adapter code all depend on this package’s contracts.
