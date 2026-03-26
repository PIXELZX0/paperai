# Operating API

This document covers the first operating-control-plane endpoints added in the PaperAI expansion work.

## Bootstrap

- `POST /api/v1/setup/board-claim`
  - Creates a short-lived board claim challenge.
  - Request body: `{ "force": boolean }`
- `POST /api/v1/setup/bootstrap-ceo`
  - Consumes a board claim challenge and creates the first operator plus the initial company.
  - Request body: `token`, `code`, `email`, `name`, `password`, and `company`.

## CLI Auth Challenge

- `POST /api/v1/auth/cli/challenges`
  - Creates a device login challenge.
- `GET /api/v1/auth/cli/challenges/:challengeId`
  - Polls challenge state.
  - Pass `challengeToken` as a query parameter to receive the approved board token once.
- `POST /api/v1/auth/cli/challenges/:challengeId/approve`
  - Requires board authentication.
  - Approves the pending challenge and issues a board API token for the CLI.

## Agent Lifecycle

- `GET /api/v1/agents/:agentId/runtime`
  - Returns runtime status plus latest heartbeat linkage.
- `GET /api/v1/agents/:agentId/sessions`
  - Returns recorded session snapshots.
- `POST /api/v1/agents/:agentId/pause`
- `POST /api/v1/agents/:agentId/resume`
- `POST /api/v1/agents/:agentId/terminate`
- `POST /api/v1/agents/:agentId/api-keys`
  - Creates a long-lived runtime API key for an agent.
- `POST /api/v1/agents/:agentId/access-token`
  - Creates a signed short-lived JWT for an agent runtime.
- `GET /api/v1/agents/me`
  - Requires agent authentication.

## Org / Costs / Workspaces

- `GET /api/v1/org-tree`
  - Returns the company org hierarchy rooted at top-level agents.
- `GET /api/v1/org-chart.svg`
  - Returns an SVG export of the same org hierarchy.
- `GET /api/v1/costs/overview`
  - Returns aggregated spend by agent, project, provider, and biller.
- `GET /api/v1/project-workspaces`
- `POST /api/v1/project-workspaces`
- `GET /api/v1/execution-workspaces`
- `POST /api/v1/execution-workspaces`

## Company Skills / Secrets

- `GET /api/v1/skills`
- `POST /api/v1/skills`
- `PATCH /api/v1/skills/:skillId`
- `POST /api/v1/skills/scan`
  - Imports local `SKILL.md` files from a filesystem root.
- `GET /api/v1/secrets`
- `POST /api/v1/secrets`
- `PATCH /api/v1/secrets/:secretId`
  - Secret references can be used in agent and plugin config via either `secret://NAME` or `{ "$secret": "NAME" }`.

## Issue Artifacts

- `GET /api/v1/issues/:issueId/documents`
- `POST /api/v1/issues/:issueId/documents`
- `PATCH /api/v1/issue-documents/:documentId`
- `GET /api/v1/issue-documents/:documentId/revisions`
- `GET /api/v1/issues/:issueId/attachments`
- `POST /api/v1/issues/:issueId/attachments`
- `GET /api/v1/issues/:issueId/work-products`
- `POST /api/v1/issues/:issueId/work-products`

## Plugin Runtime

- `POST /api/v1/plugins/:pluginId/status`
- `POST /api/v1/plugins/:pluginId/upgrade`
- `GET /api/v1/plugins/:pluginId/health`
- `POST /api/v1/plugins/:pluginId/tools/invoke`
- `POST /api/v1/plugins/:pluginId/jobs/trigger`
- `POST /api/v1/plugins/:pluginId/webhooks/trigger`
- `GET /api/v1/plugins/:pluginId/ui`

## Compatibility

- `issue` is the canonical work item model.
- `task` routes remain available as compatibility aliases over the same backing table.
