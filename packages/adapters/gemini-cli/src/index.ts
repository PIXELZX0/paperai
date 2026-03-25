import { createLocalCliAdapter } from "@paperai/adapter-local-process";

export const geminiCliAdapter = createLocalCliAdapter({
  type: "gemini_cli",
  label: "Gemini CLI",
  description: "Runs Gemini CLI locally through a subprocess adapter.",
  defaultCommand: "gemini",
});
