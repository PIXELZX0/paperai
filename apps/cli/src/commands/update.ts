import { Command } from "commander";
import type { PaperAiConfig } from "@paperai/shared";
import type { EmbeddedPostgresHandle } from "@paperai/db";
import type { CommandContext } from "../lib/context.js";
import {
  defaultPaperAiConfig,
  readInstanceConfig,
  writeInstanceConfig,
} from "../lib/config.js";
import { printJson } from "../lib/output.js";
import {
  applyDataDirOverride,
  ensureDatabaseSchema,
  ensureEmbeddedDatabase,
  ensurePaperAiHome,
  ensureWebBuild,
  resolveApiUrlFromConfig,
} from "../lib/ops.js";

type UpdateOptions = {
  config?: string;
  dataDir?: string;
};

function mergeConfigWithDefaults(current: PaperAiConfig, defaults: PaperAiConfig): PaperAiConfig {
  return {
    ...defaults,
    ...current,
    version: defaults.version,
    database: {
      ...defaults.database,
      ...current.database,
      backup: {
        ...defaults.database.backup,
        ...current.database.backup,
      },
    },
    server: {
      ...defaults.server,
      ...current.server,
    },
    auth: {
      ...defaults.auth,
      ...current.auth,
    },
  };
}

export async function updateAction(context: CommandContext, options: UpdateOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const defaults = defaultPaperAiConfig(context.runtime.env);
  const current = await readInstanceConfig(context.runtime.env);
  const next = current ? mergeConfigWithDefaults(current, defaults) : defaults;
  const configPath = await writeInstanceConfig(context.runtime.env, next);
  const apiUrl = resolveApiUrlFromConfig(next);

  const profile = await context.loadProfile();
  await context.saveProfile({
    ...profile,
    apiUrl,
  });

  let embeddedHandle: EmbeddedPostgresHandle | null = null;

  try {
    embeddedHandle = await ensureEmbeddedDatabase(next, context.runtime);
    await ensureDatabaseSchema(context.runtime);
    await ensureWebBuild(context.runtime, { force: true });
  } finally {
    if (embeddedHandle?.started) {
      await embeddedHandle.stop();
    }
  }

  printJson(context.runtime, {
    ok: true,
    configPath,
    apiUrl,
    configVersion: next.version,
    databaseMode: next.database.mode,
    configCreated: current === null,
    refreshed: ["config", "database_schema", "web_build"],
  });
}

export function registerUpdateCommand(program: Command, context: CommandContext) {
  program
    .command("update")
    .description("Refresh the local PaperAI instance to the installed version")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .action(async (options) => {
      await updateAction(context, options);
    });
}
