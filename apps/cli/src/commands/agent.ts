import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption } from "./options.js";

export async function getAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.getAgent(agentId));
}

export async function wakeAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.wakeAgent(agentId));
}

export async function pauseAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.pauseAgent(agentId));
}

export async function resumeAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.resumeAgent(agentId));
}

export async function terminateAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.terminateAgent(agentId));
}

export async function testAgentAction(
  context: CommandContext,
  agentId: string,
  options: { apiUrl?: string; token?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  printJson(context.runtime, await client.testAgent(agentId));
}

export function registerAgentCommands(program: Command, context: CommandContext) {
  const agent = program.command("agent").description("Agent commands");

  addCompanyOption(
    addApiOptions(
      agent
        .command("list")
        .description("List agents for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listAgents(companyId!));
        }),
    ),
  );

  addApiOptions(
    agent
      .command("get")
      .description("Get a single agent")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await getAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("wake")
      .description("Queue a manual wake for an agent")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await wakeAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("pause")
      .description("Pause an agent")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await pauseAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("resume")
      .description("Resume an agent and queue a wake")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await resumeAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("terminate")
      .description("Terminate an agent and clear its session")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await terminateAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("runtime")
      .description("Read the current runtime state for an agent")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.getAgentRuntime(agentId));
      }),
  );

  addApiOptions(
    agent
      .command("sessions")
      .description("List recorded agent sessions")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.listAgentSessions(agentId));
      }),
  );

  addApiOptions(
    agent
      .command("test")
      .description("Validate an agent adapter configuration")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        await testAgentAction(context, agentId, options);
      }),
  );

  addApiOptions(
    agent
      .command("reset-session")
      .description("Clear an agent session state")
      .argument("<agentId>", "agent id")
      .action(async (agentId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.resetAgentSession(agentId));
      }),
  );

  addApiOptions(
    agent
      .command("create-key")
      .description("Create an API key for an agent runtime")
      .argument("<agentId>", "agent id")
      .requiredOption("--name <name>", "key name")
      .action(async (agentId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.createAgentApiKey(agentId, options.name));
      }),
  );

  addApiOptions(
    agent
      .command("create-token")
      .description("Create a signed access token for an agent runtime")
      .argument("<agentId>", "agent id")
      .option("--expires-in-minutes <minutes>", "token lifetime in minutes")
      .action(async (agentId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        const expiresInMinutes = options.expiresInMinutes ? Number(options.expiresInMinutes) : undefined;
        printJson(context.runtime, await client.createAgentAccessToken(agentId, expiresInMinutes));
      }),
  );
}
