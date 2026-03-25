import type { AdapterDefinition, AgentAdapterType } from "@paperai/shared";
import { createHttpAdapter } from "@paperai/adapter-sdk";
import { claudeCodeAdapter } from "@paperai/adapter-claude-code";
import { codexAdapter } from "@paperai/adapter-codex";
import { geminiCliAdapter } from "@paperai/adapter-gemini-cli";
import { openCodeAdapter } from "@paperai/adapter-opencode";
import { httpApiAdapter } from "@paperai/adapter-http-api";

const openClawGatewayAdapter = createHttpAdapter({
  type: "openclaw_gateway",
  label: "OpenClaw Gateway",
  description: "Dispatches work to an OpenClaw-compatible gateway over HTTP.",
  endpoint: process.env.PAPERAI_OPENCLAW_GATEWAY_URL ?? "http://localhost:8788/execute",
});

const registry = new Map<AgentAdapterType, AdapterDefinition>([
  [claudeCodeAdapter.type, claudeCodeAdapter],
  [codexAdapter.type, codexAdapter],
  [geminiCliAdapter.type, geminiCliAdapter],
  [openCodeAdapter.type, openCodeAdapter],
  [httpApiAdapter.type, httpApiAdapter],
  [openClawGatewayAdapter.type, openClawGatewayAdapter],
]);

export function getAdapterRegistry(): Map<AgentAdapterType, AdapterDefinition> {
  return registry;
}
