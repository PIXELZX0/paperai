# APPS/CLI KNOWLEDGE BASE

## OVERVIEW

Commander-based CLI package published as `@alex110709/paperai`, exposing both `papercli` and legacy `paperai` binaries.

## STRUCTURE

```text
apps/cli/
├── src/index.ts        # Commander program assembly + main()
├── src/commands/       # subcommand registrars
├── src/lib/            # runtime/context/output helpers
└── src/*.test.ts       # vitest coverage
```

## WHERE TO LOOK

| Task                     | Location                                                                  | Notes                                 |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------- |
| Add or wire a command    | `src/index.ts`, `src/commands/*.ts`                                       | Registrars are imported centrally     |
| Invocation-name behavior | `src/index.ts`                                                            | `papercli` vs `paperai` compatibility |
| Runtime/context helpers  | `src/lib/`                                                                | Shared plumbing for commands          |
| CLI tests                | `src/index.test.ts`, `src/commands/update.test.ts`, `src/lib/ops.test.ts` | Existing patterns                     |
| Packaging/build          | `package.json`, `tsup.config.ts`                                          | cjs bundle for bins                   |

## CONVENTIONS

- Each command family registers through a `register*Commands` function imported in `src/index.ts`.
- Runtime setup is centralized through `resolveCliRuntime()` and `createCommandContext()`.
- Package scripts: `pnpm --filter @alex110709/paperai dev|build|typecheck`.

## ANTI-PATTERNS

- Do not create ad hoc Commander setup outside `buildProgram()`.
- Do not remove the legacy `paperai` alias unless compatibility policy changes.
- Do not bypass shared runtime/context helpers for output or exit handling.

## NOTES

- `src/commands/` is the densest file cluster in the repo by count.
- The CLI is both a local operator tool and a published npm package; changes affect packaged behavior, not just workspace usage.
