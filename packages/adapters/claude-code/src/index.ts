import { createLocalCliAdapter } from "@paperai/adapter-local-process";

export const claudeCodeAdapter = createLocalCliAdapter({
  type: "claude_code",
  label: "Claude Code",
  description: "Runs Claude Code locally through a subprocess adapter.",
  defaultCommand: "claude",
});
