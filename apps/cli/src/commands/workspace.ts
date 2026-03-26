import { Command, Option } from "commander";
import type { ExecutionWorkspace } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption, addIssueOption, addProjectOption } from "./options.js";

export function registerWorkspaceCommands(program: Command, context: CommandContext) {
  const workspace = program.command("workspace").description("Project and execution workspace operations");

  addProjectOption(
    addCompanyOption(
      addApiOptions(
        workspace
          .command("list-project")
          .description("List project workspaces")
          .action(async (options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const companyId = await context.resolveCompanyId(options.company);
            if (!options.project) {
              throw new CliError("Project ID is required. Pass `--project`.");
            }
            printJson(context.runtime, await client.listProjectWorkspaces(companyId!, options.project));
          }),
      ),
    ),
  );

  addProjectOption(
    addCompanyOption(
      addApiOptions(
        workspace
          .command("create-project")
          .description("Create a project workspace")
          .requiredOption("--name <name>", "workspace name")
          .option("--cwd <path>", "working directory")
          .option("--repo-url <url>", "repository URL")
          .option("--repo-ref <ref>", "repository ref")
          .option("--primary", "mark as primary workspace")
          .action(async (options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const companyId = await context.resolveCompanyId(options.company);
            if (!options.project) {
              throw new CliError("Project ID is required. Pass `--project`.");
            }
            printJson(
              context.runtime,
              await client.createProjectWorkspace(companyId!, options.project, {
                name: options.name,
                cwd: options.cwd ?? null,
                repoUrl: options.repoUrl ?? null,
                repoRef: options.repoRef ?? null,
                isPrimary: Boolean(options.primary),
              }),
            );
          }),
      ),
    ),
  );

  addIssueOption(
    addProjectOption(
      addCompanyOption(
        addApiOptions(
          workspace
            .command("list-execution")
            .description("List execution workspaces")
            .action(async (options) => {
              const client = await context.createApiClient({
                apiUrl: options.apiUrl,
                token: options.token,
              });
              const companyId = await context.resolveCompanyId(options.company);
              printJson(
                context.runtime,
                await client.listExecutionWorkspaces(companyId!, {
                  projectId: options.project,
                  issueId: options.issue,
                }),
              );
            }),
        ),
      ),
    ),
  );

  addCompanyOption(
    addApiOptions(
      workspace
        .command("create-execution")
        .description("Create an execution workspace")
        .requiredOption("--name <name>", "workspace name")
        .addOption(
          new Option("--mode <mode>", "workspace mode")
            .choices(["shared_workspace", "isolated_workspace", "adapter_managed"])
            .default("shared_workspace"),
        )
        .addOption(new Option("--status <status>", "workspace status").choices(["active", "idle", "archived"]).default("active"))
        .option("--project <projectId>", "project id")
        .option("--issue <issueId>", "issue id")
        .option("--cwd <path>", "working directory")
        .option("--repo-url <url>", "repository URL")
        .option("--base-ref <ref>", "base Git ref")
        .option("--branch-name <name>", "branch name")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(
            context.runtime,
            await client.createExecutionWorkspace(companyId!, {
              projectId: options.project ?? null,
              issueId: options.issue ?? null,
              name: options.name,
              cwd: options.cwd ?? null,
              repoUrl: options.repoUrl ?? null,
              baseRef: options.baseRef ?? null,
              branchName: options.branchName ?? null,
              mode: options.mode as ExecutionWorkspace["mode"],
              status: options.status as ExecutionWorkspace["status"],
            }),
          );
        }),
    ),
  );
}
