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

## `papercli`

PaperAI ships with an agent-first CLI for scripted and autonomous workflows.

Build the CLI:

```bash
pnpm --filter paperai build
```

Common setup:

```bash
export PAPERAI_API_URL=http://localhost:3001/api/v1
papercli auth login --email you@example.com --password 'password123'
papercli company use <company-id>
```

Agent-oriented examples:

```bash
papercli task current
papercli task comment --body "Started implementation"
papercli task complete
papercli issue block --issue <issue-id>
papercli approval resolve <approval-id> --status approved
```

Configuration precedence is `flag > env > profile > default`. The CLI stores its local profile at
`$XDG_CONFIG_HOME/papercli/config.json` or `~/.config/papercli/config.json`. The legacy `paperai`
binary remains available as a compatibility alias for `papercli`.

## CI/CD

- CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` on pushes and pull requests.
- Publishing a GitHub Release builds the production Docker image and pushes it to `ghcr.io/pixelzx0/paperai`.
- Stable releases also update the `latest` tag, while prereleases keep only the release tag.

## Docker

Build the full app image locally:

```bash
docker build -t paperai .
```

Run it with your existing server environment:

```bash
docker run --rm -p 3001:3001 --env-file .env paperai
```

The container serves the Fastify API and the built web console together. In production, the web app defaults to same-origin API calls, so no extra `VITE_API_BASE_URL` is required unless you want to point the UI at a separate API host.
