import { Command, Option } from "commander";
import { AGENT_ADAPTER_TYPES, APPROVAL_KINDS, APPROVAL_STATUSES, ISSUE_PRIORITIES, TASK_LIFECYCLE_STATUSES } from "@paperai/shared";

export function addApiOptions(command: Command) {
  return command
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token");
}

export function addCompanyOption(command: Command) {
  return command.option("--company <companyId>", "company id");
}

export function addProjectOption(command: Command) {
  return command.option("--project <projectId>", "project id");
}

export function addAgentOption(command: Command, required = false) {
  return required
    ? command.requiredOption("--agent <agentId>", "agent id")
    : command.option("--agent <agentId>", "agent id");
}

export function addTaskOption(command: Command) {
  return command.option("--task <taskId>", "task id");
}

export function addIssueOption(command: Command) {
  return command.option("--issue <issueId>", "issue id");
}

export function addBodyOptions(command: Command) {
  return command
    .option("--body <text>", "inline body text")
    .option("--body-file <path>", "path to a body text file");
}

export function addTaskMutationOptions(command: Command) {
  return command
    .option("--title <title>", "task title")
    .option("--description <description>", "task description")
    .addOption(new Option("--status <status>", "task status").choices([...TASK_LIFECYCLE_STATUSES]))
    .addOption(new Option("--priority <priority>", "task priority").choices([...ISSUE_PRIORITIES]))
    .option("--assignee <agentId>", "assignee agent id")
    .option("--project <projectId>", "project id")
    .option("--goal <goalId>", "goal id")
    .option("--parent <taskId>", "parent task id")
    .option("--origin-kind <kind>", "origin kind")
    .option("--origin-ref <ref>", "origin ref")
    .option("--metadata <json>", "metadata JSON object");
}

export function addIssueMutationOptions(command: Command) {
  return command
    .option("--title <title>", "issue title")
    .option("--description <description>", "issue description")
    .addOption(new Option("--status <status>", "issue status").choices([...TASK_LIFECYCLE_STATUSES]))
    .addOption(new Option("--priority <priority>", "issue priority").choices([...ISSUE_PRIORITIES]))
    .option("--assignee <agentId>", "assignee agent id")
    .option("--project <projectId>", "project id")
    .option("--goal <goalId>", "goal id")
    .option("--parent <issueId>", "parent issue id")
    .option("--origin-kind <kind>", "origin kind")
    .option("--origin-ref <ref>", "origin ref")
    .option("--metadata <json>", "metadata JSON object");
}

export function addApprovalCreateOptions(command: Command) {
  return command
    .addOption(new Option("--kind <kind>", "approval kind").choices([...APPROVAL_KINDS]).makeOptionMandatory())
    .requiredOption("--title <title>", "approval title")
    .option("--description <description>", "approval description")
    .option("--payload <json>", "payload JSON object");
}

export function addApprovalResolveOptions(command: Command) {
  return command
    .addOption(
      new Option("--status <status>", "approval resolution status")
        .choices(
          APPROVAL_STATUSES.filter(
            (status): status is "approved" | "rejected" => status === "approved" || status === "rejected",
          ),
        )
        .makeOptionMandatory(),
    )
    .option("--resolution-notes <text>", "resolution notes");
}

export function addPluginManifestOptions(command: Command) {
  return command
    .option("--manifest <json>", "plugin manifest JSON")
    .option("--manifest-file <path>", "path to a plugin manifest JSON file");
}

export function addAgentCreateOptions(command: Command) {
  return command
    .requiredOption("--slug <slug>", "agent slug")
    .requiredOption("--name <name>", "agent name")
    .option("--title <title>", "agent title")
    .option("--capabilities <text>", "agent capabilities")
    .option("--parent <agentId>", "parent agent id")
    .addOption(new Option("--adapter-type <type>", "adapter type").choices([...AGENT_ADAPTER_TYPES]).makeOptionMandatory())
    .option("--adapter-config <json>", "adapter config JSON object")
    .option("--runtime-config <json>", "runtime config JSON object")
    .option("--permissions <json>", "permissions JSON array")
    .option("--budget <cents>", "monthly budget in cents");
}
