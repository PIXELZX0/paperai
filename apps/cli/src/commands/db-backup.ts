import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import { readInstanceConfig } from "../lib/config.js";
import { printJson } from "../lib/output.js";
import {
  applyDataDirOverride,
  createDatabaseBackup,
  ensureEmbeddedDatabase,
  ensurePgDumpAvailable,
  ensurePaperAiHome,
  resolveBackupPath,
} from "../lib/ops.js";

type BackupOptions = {
  config?: string;
  dataDir?: string;
  output?: string;
};

export async function dbBackupAction(context: CommandContext, options: BackupOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const config = await readInstanceConfig(context.runtime.env);
  if (!config) {
    throw new CliError("No PaperAI config found. Run `paperai onboard` first.");
  }

  const embeddedHandle = await ensureEmbeddedDatabase(config, context.runtime);
  const connectionString = context.runtime.env.DATABASE_URL ?? config.database.connectionString;
  if (!connectionString) {
    throw new CliError("No database connection string is available for backup.");
  }

  await ensurePgDumpAvailable(context.runtime);
  const outputPath = await resolveBackupPath(config, options.output);
  await createDatabaseBackup(context.runtime, connectionString, outputPath);

  if (embeddedHandle?.started) {
    await embeddedHandle.stop();
  }

  printJson(context.runtime, {
    ok: true,
    outputPath,
  });
}

export function registerDbBackupCommands(program: Command, context: CommandContext) {
  program
    .command("db:backup")
    .description("Create a SQL backup of the configured PaperAI database")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .option("--output <file>", "backup file name or absolute path")
    .action(async (options) => {
      await dbBackupAction(context, options);
    });
}
