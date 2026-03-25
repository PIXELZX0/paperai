import { createLocalCliAdapter } from "@paperai/adapter-local-process";

export const codexAdapter = createLocalCliAdapter({
  type: "codex",
  label: "Codex",
  description: "Runs Codex locally through a subprocess adapter.",
  defaultCommand: "codex",
});
