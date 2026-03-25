import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { wakeAgentAction, testAgentAction } from "./agent.js";
import { scaffoldCompanyPackage, inspectPackageAction, importPackageAction, exportPackageAction } from "./package.js";
import { validatePluginAction } from "./plugin.js";
import { createTaskAction } from "./task.js";

export function registerLegacyCommands(program: Command, context: CommandContext) {
  program
    .command("init")
    .description("Legacy alias for `package init`")
    .argument("[dir]", "directory to initialize", "paperai-company")
    .action(async (dir: string) => {
      await scaffoldCompanyPackage(dir);
      context.runtime.stdout.write(`${JSON.stringify({ ok: true, root: dir }, null, 2)}\n`);
    });

  program
    .command("agent:wake")
    .description("Legacy alias for `agent wake`")
    .argument("<agentId>", "agent id")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (agentId: string, options: { apiUrl?: string; token?: string }) => {
      await wakeAgentAction(context, agentId, options);
    });

  program
    .command("agent:test")
    .description("Legacy alias for `agent test`")
    .argument("<agentId>", "agent id")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (agentId: string, options: { apiUrl?: string; token?: string }) => {
      await testAgentAction(context, agentId, options);
    });

  program
    .command("task:create")
    .description("Legacy alias for `task create`")
    .requiredOption("--company <companyId>", "company id")
    .requiredOption("--title <title>", "task title")
    .option("--description <description>", "task description")
    .option("--assignee <agentId>", "assignee agent id")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(
      async (options: {
        company?: string;
        title?: string;
        description?: string;
        assignee?: string;
        apiUrl?: string;
        token?: string;
      }) => {
      await createTaskAction(context, options);
      },
    );

  program
    .command("import-company")
    .description("Legacy alias for `package import`")
    .requiredOption("--company <companyId>", "company id")
    .requiredOption("--root <root>", "package directory")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (options: { company?: string; root: string; apiUrl?: string; token?: string }) => {
      await importPackageAction(context, options);
    });

  program
    .command("export-company")
    .description("Legacy alias for `package export`")
    .requiredOption("--company <companyId>", "company id")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (options: { company?: string; apiUrl?: string; token?: string }) => {
      await exportPackageAction(context, options);
    });

  program
    .command("package:inspect")
    .description("Legacy alias for `package inspect`")
    .argument("<root>", "package directory")
    .action(async (root: string) => {
      await inspectPackageAction(context, root);
    });

  program
    .command("plugin:validate")
    .description("Legacy alias for `plugin validate`")
    .option("--manifest <json>", "plugin manifest JSON")
    .option("--manifest-file <path>", "path to a plugin manifest JSON file")
    .action(async (options: { manifest?: string; manifestFile?: string }) => {
      await validatePluginAction(context, options);
    });
}
