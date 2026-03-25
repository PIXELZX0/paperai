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

## Compatibility

- `issue` is the canonical work item model.
- `task` routes remain available as compatibility aliases over the same backing table.
