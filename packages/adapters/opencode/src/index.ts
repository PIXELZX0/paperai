import { createLocalCliAdapter } from "@paperai/adapter-local-process";

export const openCodeAdapter = createLocalCliAdapter({
  type: "opencode",
  label: "OpenCode",
  description: "Runs OpenCode locally through a subprocess adapter.",
  defaultCommand: "opencode",
});
