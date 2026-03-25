import type { AdapterDefinition, AgentAdapterType } from "@paperai/shared";
import { claudeCodeAdapter } from "@paperai/adapter-claude-code";
import { codexAdapter } from "@paperai/adapter-codex";
import { geminiCliAdapter } from "@paperai/adapter-gemini-cli";
import { openCodeAdapter } from "@paperai/adapter-opencode";
import { httpApiAdapter } from "@paperai/adapter-http-api";

const registry = new Map<AgentAdapterType, AdapterDefinition>([
  [claudeCodeAdapter.type, claudeCodeAdapter],
  [codexAdapter.type, codexAdapter],
  [geminiCliAdapter.type, geminiCliAdapter],
  [openCodeAdapter.type, openCodeAdapter],
  [httpApiAdapter.type, httpApiAdapter],
]);

export function getAdapterRegistry(): Map<AgentAdapterType, AdapterDefinition> {
  return registry;
}
