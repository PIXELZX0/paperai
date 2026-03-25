import { Command } from "commander";
import type { Task } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { readBodyInput, parseJsonObject } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addAgentOption, addApiOptions, addBodyOptions, addCompanyOption, addTaskMutationOptions, addTaskOption } from "./options.js";

interface TaskMutationOptions {
  title?: string;
  description?: string;
  status?: Task["status"];
  priority?: Task["priority"];
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

async function buildTaskPayload(context: CommandContext, options: TaskMutationOptions, includeRequiredDefaults = false) {
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
    payload.parentTaskId = options.parent || null;
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

function requireTaskMutation(payload: Record<string, unknown>) {
  if (Object.keys(payload).length === 0) {
    throw new CliError("No task changes were provided.");
  }
}

export async function createTaskAction(
  context: CommandContext,
  options: TaskMutationOptions & { apiUrl?: string; token?: string; company?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  const companyId = await context.resolveCompanyId(options.company);
  const payload = await buildTaskPayload(context, options, true);

  if (!payload.title) {
    throw new CliError("Task title is required.");
  }

  printJson(context.runtime, await client.createTask(companyId!, payload));
}

export function registerTaskCommands(program: Command, context: CommandContext) {
  const task = program.command("task").description("Task commands");

  addCompanyOption(
    addApiOptions(
      task
        .command("list")
        .description("List tasks for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listTasks(companyId!));
        }),
    ),
  );

  addTaskOption(
    addApiOptions(
      task
        .command("get")
        .description("Get a single task")
        .argument("[taskId]", "task id")
        .action(async (taskId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
          printJson(context.runtime, await client.getTask(resolvedTaskId!));
        }),
    ),
  );

  addTaskOption(
    addApiOptions(
      task
        .command("current")
        .description("Get the current task from flags or environment")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const taskId = context.resolveTaskId(options.task);
          printJson(context.runtime, await client.getTask(taskId!));
        }),
    ),
  );

  addCompanyOption(
    addBodyOptions(
      addTaskMutationOptions(
        addApiOptions(
          task
            .command("create")
            .description("Create a task")
            .action(async (options) => {
              await createTaskAction(context, options);
            }),
        ),
      ),
    ),
  );

  addTaskOption(
    addBodyOptions(
      addTaskMutationOptions(
        addApiOptions(
          task
            .command("update")
            .description("Update a task")
            .argument("[taskId]", "task id")
            .action(async (taskId: string | undefined, options) => {
              const client = await context.createApiClient({
                apiUrl: options.apiUrl,
                token: options.token,
              });
              const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
              const payload = await buildTaskPayload(context, options);
              requireTaskMutation(payload);
              printJson(context.runtime, await client.updateTask(resolvedTaskId!, payload));
            }),
        ),
      ),
    ),
  );

  addTaskOption(
    addAgentOption(
      addApiOptions(
        task
          .command("checkout")
          .description("Check out a task for an agent")
          .argument("[taskId]", "task id")
          .option("--heartbeat-run-id <id>", "heartbeat run id")
          .action(async (taskId: string | undefined, options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
            const agentId = context.resolveAgentId(options.agent);
            printJson(
              context.runtime,
              await client.checkoutTask(resolvedTaskId!, agentId!, options.heartbeatRunId),
            );
          }),
      ),
    ),
  );

  addTaskOption(
    addBodyOptions(
      addApiOptions(
        task
          .command("comment")
          .description("Add a comment to a task")
          .argument("[taskId]", "task id")
          .action(async (taskId: string | undefined, options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
            const body = await readBodyInput(context.runtime, options, true);
            printJson(context.runtime, await client.addTaskComment(resolvedTaskId!, body!));
          }),
      ),
    ),
  );

  addTaskOption(
    addApiOptions(
      task
        .command("complete")
        .description("Mark a task as done")
        .argument("[taskId]", "task id")
        .action(async (taskId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
          printJson(context.runtime, await client.updateTask(resolvedTaskId!, { status: "done" }));
        }),
    ),
  );

  addTaskOption(
    addApiOptions(
      task
        .command("block")
        .description("Mark a task as blocked")
        .argument("[taskId]", "task id")
        .action(async (taskId: string | undefined, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const resolvedTaskId = context.resolveTaskId(taskId ?? options.task);
          printJson(context.runtime, await client.updateTask(resolvedTaskId!, { status: "blocked" }));
        }),
    ),
  );
}
