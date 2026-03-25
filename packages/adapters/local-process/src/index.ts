import { createLocalAdapter } from "@paperai/adapter-sdk";

export function createLocalCliAdapter(input: {
  type: "claude_code" | "codex" | "gemini_cli" | "opencode";
  label: string;
  description: string;
  defaultCommand: string;
  defaultArgs?: string[];
}) {
  return createLocalAdapter({
    type: input.type,
    label: input.label,
    description: input.description,
    buildCommand(context) {
      const config = context.agent.adapterConfig;
      const command = String(config.command ?? input.defaultCommand);
      const args = Array.isArray(config.args)
        ? config.args.map((value) => String(value))
        : input.defaultArgs ?? [];

      return {
        command,
        args,
        cwd: context.cwd ?? undefined,
        env: {
          PAPERAI_AGENT_ID: context.agent.id,
          PAPERAI_COMPANY_ID: context.company.id,
          PAPERAI_TASK_ID: context.task?.id ?? "",
          PAPERAI_INSTRUCTIONS: context.instructions,
        },
      };
    },
  });
}
