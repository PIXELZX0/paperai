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
}
