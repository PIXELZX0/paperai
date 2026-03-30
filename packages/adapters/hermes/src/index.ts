import { createLocalAdapter, type CommandBuilder } from "@paperai/adapter-sdk";

const DEFAULT_TOOLSETS = ["terminal", "file", "web", "skills"];

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => entry !== null);
  }

  const single = asString(value);
  return single ? [single] : [];
}

export const buildHermesCommand: CommandBuilder = (context) => {
  const config = context.agent.adapterConfig;
  const command = asString(config.command) ?? "hermes";
  const args = [asString(config.subcommand) ?? "chat"];

  const provider = asString(config.provider);
  if (provider) {
    args.push("--provider", provider);
  }

  const model = asString(config.model);
  if (model) {
    args.push("--model", model);
  }

  const toolsets = asStringArray(config.toolsets);
  args.push("--toolsets", (toolsets.length > 0 ? toolsets : DEFAULT_TOOLSETS).join(","));

  if (asBoolean(config.worktree)) {
    args.push("--worktree");
  }

  const resume = asString(config.resume);
  if (resume) {
    args.push("--resume", resume);
  } else if (asBoolean(config.continue)) {
    args.push("--continue");
  }

  if (asBoolean(config.verbose)) {
    args.push("--verbose");
  }

  args.push(...asStringArray(config.args));
  args.push("-q", context.instructions);

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
};

export const hermesAdapter = createLocalAdapter({
  type: "hermes",
  label: "Hermes Agent",
  description: "Runs Hermes locally through the Hermes CLI.",
  supportsSessions: false,
  buildCommand: buildHermesCommand,
});
