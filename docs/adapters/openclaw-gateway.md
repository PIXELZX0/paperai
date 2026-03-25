# OpenClaw Gateway Adapter

PaperAI now exposes `openclaw_gateway` as a first-class adapter type.

## Purpose

Use `openclaw_gateway` when an agent should execute through an OpenClaw-compatible HTTP gateway instead of a local CLI process.

## Configuration

- Adapter type: `openclaw_gateway`
- Default endpoint: `http://localhost:8788/execute`
- Override with `PAPERAI_OPENCLAW_GATEWAY_URL`

## Notes

- The adapter is implemented as an HTTP adapter in the current phase.
- Agent authentication can use either a long-lived agent API key or a short-lived signed access token.
- This is the compatibility layer for the operating-control-plane rollout; richer gateway-specific onboarding can be added later without changing the public adapter type.
