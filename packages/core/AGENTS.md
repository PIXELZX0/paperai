# PACKAGES/CORE KNOWLEDGE BASE

## OVERVIEW

Shared domain logic package for RBAC, budgets, context, audit/events, and task transition rules.

## WHERE TO LOOK

| Task                    | Location                                | Notes                   |
| ----------------------- | --------------------------------------- | ----------------------- |
| Public exports          | `src/index.ts`                          | Re-export surface       |
| Budget logic            | `src/budget.ts`, `src/budget.test.ts`   | Covered by tests        |
| Execution/context rules | `src/context.ts`, `src/context.test.ts` | Shared runtime helpers  |
| Role/permission logic   | `src/rbac.ts`, `src/rbac.test.ts`       | Permission source       |
| Task state rules        | `src/tasks.ts`                          | Transition matrix       |
| Audit/events            | `src/audit.ts`, `src/events.ts`         | Shared event structures |

## CONVENTIONS

- Public API is flat re-exports from `src/index.ts`.
- Tests live beside source files and use Vitest naming `*.test.ts`.
- Package scripts: `pnpm --filter @paperai/core build|typecheck`.

## ANTI-PATTERNS

- Do not duplicate task or RBAC rules inside apps.
- Do not introduce app-specific side effects here; keep this package portable.

## NOTES

- `src/tasks.ts` is intentionally tiny and rule-driven; preserve that style.
- When domain rules are reused by server and CLI, this package is the first place to check.
