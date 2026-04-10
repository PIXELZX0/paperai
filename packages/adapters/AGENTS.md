# PACKAGES/ADAPTERS KNOWLEDGE BASE

## OVERVIEW

Collection of thin concrete adapter packages wrapping shared adapter SDKs for local CLI tools and HTTP workers.

## STRUCTURE

```text
packages/adapters/
├── claude-code/   # local Claude Code wrapper
├── codex/         # local Codex wrapper
├── gemini-cli/    # local Gemini CLI wrapper
├── hermes/        # local Hermes wrapper
├── http-api/      # remote HTTP worker wrapper
├── local-process/ # shared local CLI adapter factory
└── opencode/      # local OpenCode wrapper
```

## WHERE TO LOOK

| Task                                  | Location                      | Notes                                           |
| ------------------------------------- | ----------------------------- | ----------------------------------------------- |
| Shared local adapter behavior         | `local-process/src/index.ts`  | `createLocalCliAdapter()`                       |
| Shared HTTP adapter behavior          | `../adapter-sdk/src/index.ts` | `createHttpAdapter()` lives outside this folder |
| Claude/Codex/Gemini/OpenCode wrappers | `*/src/index.ts`              | Usually tiny config-only wrappers               |
| HTTP worker wrapper                   | `http-api/src/index.ts`       | Reads `PAPERAI_HTTP_ADAPTER_URL`                |

## CONVENTIONS

- Concrete adapter packages should stay thin; shared execution behavior belongs in `adapter-sdk` or `local-process`.
- Every adapter package follows the same export/build shape: `src/index.ts`, tsup build, tsc typecheck.
- Run per-package scripts with the concrete package name, e.g. `pnpm --filter @paperai/adapter-http-api build`.

## ANTI-PATTERNS

- Do not duplicate subprocess/session retry logic across concrete adapters.
- Do not embed provider-specific runtime logic in multiple sibling wrappers when one shared helper can own it.

## NOTES

- The server depends on multiple sibling adapter packages directly.
- `http-api` is the main non-local variant; most others are local CLI wrappers.
