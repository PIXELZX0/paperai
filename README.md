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

Local instance lifecycle:

```bash
paperai onboard --yes
paperai update
paperai doctor
```

Operating extensions:

```bash
papercli company org
papercli company cost-overview
papercli company finance-events
papercli company quota-windows
papercli company join-requests
papercli company resolve-join-request <join-request-id> --status approved
papercli workspace create-project --project <project-id> --name main --primary
papercli skill scan --root ~/.codex/skills
papercli secret create --name OPENAI_API_KEY --value '...'
papercli plugin health <plugin-id>
```

Configuration precedence is `flag > env > profile > default`. The CLI stores its local profile at
`$XDG_CONFIG_HOME/papercli/config.json` or `~/.config/papercli/config.json`. The legacy `paperai`
binary remains available as a compatibility alias for `papercli`.

## CI/CD

- CI runs `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` on pushes and pull requests.
- Local operator checks are also available via `pnpm smoke:release:local`, `pnpm eval:operating`, and `pnpm test:e2e`.
- Publishing a GitHub Release builds the production Docker image and pushes it to `yuchanshin/paperai`.
- GitHub Releases push `latest` plus the release tag, and pushes to `main` publish `test-latest` plus a timestamped `test-YYYY-MM-DD-HH-MM-SS` tag.

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

The production image now bundles a headless Chromium runtime for agents. Inside the container, agents can use:

```bash
paperai-browser --version
paperai-browser --virtual-time-budget=5000 --screenshot=/tmp/page.png https://example.com
```

Related environment variables are preconfigured:

- `PAPERAI_HEADLESS_BROWSER_BIN`
- `PAPERAI_HEADLESS_BROWSER_WRAPPER`
- `PUPPETEER_EXECUTABLE_PATH`
- `CHROME_BIN`
- `CHROMIUM_BIN`

The image also installs the local agent CLIs used by subprocess adapters:

- `opencode`
- `claude`
- `gemini`
- `codex`

If you want deterministic tool versions, override the default `latest` tags at build time:

```bash
docker build -t paperai \
  --build-arg OPENCODE_VERSION=latest \
  --build-arg CLAUDE_CODE_VERSION=latest \
  --build-arg GEMINI_CLI_VERSION=latest \
  --build-arg CODEX_VERSION=latest .
```

At runtime, provide the credentials those tools need through your environment file, such as `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `GEMINI_API_KEY`. OpenCode can also use provider-specific keys depending on which model backend you configure.

A reusable agent skill lives at `skills/headless-browser/SKILL.md`.
