import { Command } from "commander";
import type { Issue } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { parseJsonObject, readBodyInput } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addAgentOption, addApiOptions, addBodyOptions, addCompanyOption, addIssueMutationOptions, addIssueOption } from "./options.js";

interface IssueMutationOptions {
  title?: string;
  description?: string;
  status?: Issue["status"];
  priority?: Issue["priority"];
  assignee?: string;
  project?: string;
  goal?: string;
  parent?: string;
  originKind?: string;
  originRef?: string;
  metadata?: string;
  body?: string;
  bodyFile?: string;
}

async function buildIssuePayload(context: CommandContext, options: IssueMutationOptions, includeRequiredDefaults = false) {
  const description = options.description ?? (await readBodyInput(context.runtime, options, false));
  const payload: Record<string, unknown> = {};

  if (options.title !== undefined) {
    payload.title = options.title;
  }
  if (description !== undefined) {
    payload.description = description;
  }
  if (options.status !== undefined) {
    payload.status = options.status;
  } else if (includeRequiredDefaults) {
    payload.status = "todo";
  }
  if (options.priority !== undefined) {
    payload.priority = options.priority;
  } else if (includeRequiredDefaults) {
    payload.priority = "medium";
  }
  if (options.assignee !== undefined) {
    payload.assigneeAgentId = options.assignee || null;
  }
  if (options.project !== undefined) {
    payload.projectId = options.project || null;
  }
  if (options.goal !== undefined) {
    payload.goalId = options.goal || null;
  }
  if (options.parent !== undefined) {
    payload.parentId = options.parent || null;
  }
  if (options.originKind !== undefined) {
    payload.originKind = options.originKind;
  } else if (includeRequiredDefaults) {
    payload.originKind = "manual";
  }
  if (options.originRef !== undefined) {
    payload.originRef = options.originRef || null;
  }

  const metadata = parseJsonObject(options.metadata, "metadata");
  if (metadata !== undefined) {
    payload.metadata = metadata;
  } else if (includeRequiredDefaults) {
    payload.metadata = {};
  }

  return payload;
}

function requireIssueMutation(payload: Record<string, unknown>) {
  if (Object.keys(payload).length === 0) {
    throw new CliError("No issue changes were provided.");
  }
}

export function registerIssueCommands(program: Command, context: CommandContext) {
  const issue = program.command("issue").description("Issue commands");

  addCompanyOption(
    addApiOptions(
      issue
        .command("list")
        .description("List issues for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listIssues(companyId!));
        }),
    ),
  );

  addIssueOption(
    addApiOptions(
      issue
        .command("get")
        .description("Get a single issue")
        .argument("[issueId]", "issue id")
        .action(async (issueId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
          printJson(context.runtime, await client.getIssue(resolvedIssueId!));
        }),
    ),
  );

  addCompanyOption(
    addBodyOptions(
      addIssueMutationOptions(
        addApiOptions(
          issue
            .command("create")
            .description("Create an issue")
            .action(async (options) => {
              const client = await context.createApiClient({
                apiUrl: options.apiUrl,
                token: options.token,
              });
              const companyId = await context.resolveCompanyId(options.company);
              const payload = await buildIssuePayload(context, options, true);
              printJson(context.runtime, await client.createIssue(companyId!, payload));
            }),
        ),
      ),
    ),
  );

  addIssueOption(
    addBodyOptions(
      addIssueMutationOptions(
        addApiOptions(
          issue
            .command("update")
            .description("Update an issue")
            .argument("[issueId]", "issue id")
            .action(async (issueId: string | undefined, options) => {
              const client = await context.createApiClient({
                apiUrl: options.apiUrl,
                token: options.token,
              });
              const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
              const payload = await buildIssuePayload(context, options);
              requireIssueMutation(payload);
              printJson(context.runtime, await client.updateIssue(resolvedIssueId!, payload));
            }),
        ),
      ),
    ),
  );

  addIssueOption(
    addAgentOption(
      addApiOptions(
        issue
          .command("checkout")
          .description("Check out an issue for an agent")
          .argument("[issueId]", "issue id")
          .option("--heartbeat-run-id <id>", "heartbeat run id")
          .action(async (issueId: string | undefined, options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
            const agentId = context.resolveAgentId(options.agent);
            printJson(
              context.runtime,
              await client.checkoutIssue(resolvedIssueId!, agentId!, options.heartbeatRunId),
            );
          }),
      ),
    ),
  );

  addIssueOption(
    addBodyOptions(
      addApiOptions(
        issue
          .command("comment")
          .description("Add a comment to an issue")
          .argument("[issueId]", "issue id")
          .action(async (issueId: string | undefined, options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
            const body = await readBodyInput(context.runtime, options, true);
            printJson(context.runtime, await client.addIssueComment(resolvedIssueId!, body!));
          }),
      ),
    ),
  );

  addIssueOption(
    addApiOptions(
      issue
        .command("complete")
        .description("Mark an issue as done")
        .argument("[issueId]", "issue id")
        .action(async (issueId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
          printJson(context.runtime, await client.updateIssue(resolvedIssueId!, { status: "done" }));
        }),
    ),
  );

  addIssueOption(
    addApiOptions(
      issue
        .command("block")
        .description("Mark an issue as blocked")
        .argument("[issueId]", "issue id")
        .action(async (issueId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedIssueId = context.resolveIssueId(issueId ?? options.issue);
          printJson(context.runtime, await client.updateIssue(resolvedIssueId!, { status: "blocked" }));
        }),
    ),
  );
}
