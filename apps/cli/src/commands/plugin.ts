import { Command } from "commander";
import { validatePluginManifest } from "@paperai/plugin-sdk";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { readBodyInput } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addPluginManifestOptions } from "./options.js";

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
  addPluginManifestOptions(
    program
      .command("plugin")
      .description("Plugin manifest helpers")
      .command("validate")
      .description("Validate a plugin manifest")
      .action(async (options) => {
        await validatePluginAction(context, options);
      }),
  );
}
