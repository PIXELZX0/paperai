import { Command } from "commander";
import { validatePluginManifest } from "@paperai/plugin-sdk";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { parseJsonObject, readBodyInput } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption, addPluginManifestOptions } from "./options.js";

export async function validatePluginAction(
  context: CommandContext,
  options: { manifest?: string; manifestFile?: string },
) {
  const source = await readBodyInput(
    context.runtime,
    {
      body: options.manifest,
      bodyFile: options.manifestFile,
    },
    true,
  );

  try {
    const manifest = JSON.parse(source!);
    printJson(context.runtime, validatePluginManifest(manifest));
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    throw new CliError("Invalid plugin manifest JSON.");
  }
}

export function registerPluginCommands(program: Command, context: CommandContext) {
  const plugin = program.command("plugin").description("Plugin runtime and manifest helpers");

  addPluginManifestOptions(
    plugin
      .command("validate")
      .description("Validate a plugin manifest")
      .action(async (options) => {
        await validatePluginAction(context, options);
      }),
  );

  addCompanyOption(
    addApiOptions(
      plugin
        .command("list")
        .description("List installed plugins")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listPlugins(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addPluginManifestOptions(
      addApiOptions(
        plugin
          .command("create")
          .description("Install a plugin from a manifest")
          .requiredOption("--slug <slug>", "plugin slug")
          .requiredOption("--name <name>", "plugin name")
          .option("--config <json>", "plugin config JSON object")
          .action(async (options) => {
            const source = await readBodyInput(
              context.runtime,
              {
                body: options.manifest,
                bodyFile: options.manifestFile,
              },
              true,
            );
            const manifest = JSON.parse(source!);
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const companyId = await context.resolveCompanyId(options.company);
            printJson(
              context.runtime,
              await client.createPlugin(companyId!, {
                slug: options.slug,
                name: options.name,
                manifest,
                config: parseJsonObject(options.config, "config") ?? {},
              }),
            );
          }),
      ),
    ),
  );

  addApiOptions(
    plugin
      .command("enable")
      .description("Enable a plugin")
      .argument("<pluginId>", "plugin id")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.setPluginStatus(pluginId, "active"));
      }),
  );

  addApiOptions(
    plugin
      .command("disable")
      .description("Disable a plugin")
      .argument("<pluginId>", "plugin id")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.setPluginStatus(pluginId, "disabled"));
      }),
  );

  addPluginManifestOptions(
    addApiOptions(
      plugin
        .command("upgrade")
        .description("Upgrade a plugin manifest/config")
        .argument("<pluginId>", "plugin id")
        .option("--config <json>", "plugin config JSON object")
        .action(async (pluginId: string, options) => {
          const source = await readBodyInput(
            context.runtime,
            {
              body: options.manifest,
              bodyFile: options.manifestFile,
            },
            true,
          );
          const manifest = JSON.parse(source!);
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          printJson(
            context.runtime,
            await client.upgradePlugin(pluginId, {
              manifest,
              config: parseJsonObject(options.config, "config") ?? {},
            }),
          );
        }),
    ),
  );

  addApiOptions(
    plugin
      .command("health")
      .description("Check plugin health")
      .argument("<pluginId>", "plugin id")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.getPluginHealth(pluginId));
      }),
  );

  addApiOptions(
    plugin
      .command("invoke-tool")
      .description("Invoke a plugin tool")
      .argument("<pluginId>", "plugin id")
      .requiredOption("--tool <name>", "tool name")
      .option("--input <json>", "tool input JSON object")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(
          context.runtime,
          await client.invokePluginTool(pluginId, options.tool, parseJsonObject(options.input, "input") ?? {}),
        );
      }),
  );

  addApiOptions(
    plugin
      .command("trigger-job")
      .description("Trigger a plugin job")
      .argument("<pluginId>", "plugin id")
      .requiredOption("--job <key>", "job key")
      .option("--input <json>", "job input JSON object")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(
          context.runtime,
          await client.triggerPluginJob(pluginId, options.job, parseJsonObject(options.input, "input") ?? {}),
        );
      }),
  );

  addApiOptions(
    plugin
      .command("trigger-webhook")
      .description("Trigger a plugin webhook")
      .argument("<pluginId>", "plugin id")
      .requiredOption("--webhook <key>", "webhook key")
      .option("--payload <json>", "webhook payload JSON object")
      .action(async (pluginId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(
          context.runtime,
          await client.triggerPluginWebhook(pluginId, options.webhook, parseJsonObject(options.payload, "payload") ?? {}),
        );
      }),
  );
}
