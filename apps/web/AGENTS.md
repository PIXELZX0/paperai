# APPS/WEB KNOWLEDGE BASE

## OVERVIEW

React 19 + React Router + React Query operator console for PaperAI.

## STRUCTURE

```text
apps/web/
├── src/main.tsx        # browser mount
├── src/app.tsx         # router root
├── src/routes/         # auth page + massive dashboard page
├── src/components/     # reusable UI pieces
├── src/lib/            # API/session helpers
└── e2e/                # Playwright coverage
```

## WHERE TO LOOK

| Task                  | Location                             | Notes                              |
| --------------------- | ------------------------------------ | ---------------------------------- |
| App bootstrap         | `src/main.tsx`                       | Mounts `App` into `#root`          |
| Route table           | `src/app.tsx`                        | `/` and `/app/:section?`           |
| Most operator UI work | `src/routes/dashboard-page.tsx`      | Dominant frontend hotspot          |
| Login/auth UI         | `src/routes/auth-page.tsx`           | Minimal auth route                 |
| Shared UI bits        | `src/components/`                    | Small component pool               |
| Session/API helpers   | `src/lib/`                           | Read before adding new fetch logic |
| E2E coverage          | `e2e/` + root `playwright.config.ts` | Browser checks live here           |

## CONVENTIONS

- Data fetching and invalidation run through React Query.
- Router is defined centrally in `src/app.tsx`; most feature state is concentrated in `dashboard-page.tsx`.
- Build script typechecks before bundling: `tsc --noEmit && vite build`.
- Package scripts: `pnpm --filter @paperai/web dev|build|typecheck`.

## ANTI-PATTERNS

- Do not add duplicate API contract types locally; use `@paperai/shared`.
- Do not scatter dashboard behavior across many new pages unless the existing route structure is truly changing.
- Do not assume separate API origin in production; same-origin is the default container path.

## NOTES

- `dashboard-page.tsx` is very large; prefer extending existing sections with discipline rather than introducing parallel state systems.
- Playwright is configured as fully parallel and targets `apps/web/e2e`.
