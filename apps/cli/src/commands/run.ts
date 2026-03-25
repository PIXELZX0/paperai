import { Command } from "commander";
import type { EmbeddedPostgresHandle } from "@paperai/db";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import {
  defaultPaperAiConfig,
  readInstanceConfig,
  writeInstanceConfig,
} from "../lib/config.js";
import {
  applyDataDirOverride,
  ensureDatabaseSchema,
  ensureEmbeddedDatabase,
  ensurePaperAiHome,
  ensureWebBuild,
} from "../lib/ops.js";

type RunOptions = {
  config?: string;
  dataDir?: string;
  skipOnboard?: boolean;
};

export async function runAction(context: CommandContext, options: RunOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  let config = await readInstanceConfig(context.runtime.env);
  if (!config) {
    if (options.skipOnboard) {
      throw new CliError("PaperAI config was expected to exist but was not found.");
    }

    config = defaultPaperAiConfig(context.runtime.env);
    await writeInstanceConfig(context.runtime.env, config);
  }

  let embeddedHandle: EmbeddedPostgresHandle | null = null;
  let close = async () => {};

  try {
    embeddedHandle = await ensureEmbeddedDatabase(config, context.runtime);
    context.runtime.env.PORT = String(config.server.port);
    context.runtime.env.HOST = config.server.host;
    context.runtime.env.JWT_SECRET = config.server.jwtSecret;
    context.runtime.env.PAPERAI_WEB_ORIGIN = config.server.webOrigin;
    context.runtime.env.BOARD_CLAIM_TTL_MINUTES = String(config.auth.boardClaimTtlMinutes);
    context.runtime.env.CLI_CHALLENGE_TTL_MINUTES = String(config.auth.cliChallengeTtlMinutes);
    context.runtime.env.AGENT_TOKEN_TTL_MINUTES = String(config.auth.agentTokenTtlMinutes);

    await ensureDatabaseSchema(context.runtime);
    await ensureWebBuild(context.runtime);

    const { startServer } = await import("@paperai/server");
    const started = await startServer();

    close = async () => {
      await new Promise<void>((resolve, reject) => {
        started.server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      if (embeddedHandle?.started) {
        await embeddedHandle.stop();
      }
    };

    process.once("SIGINT", () => {
      void close().finally(() => process.exit(0));
    });
    process.once("SIGTERM", () => {
      void close().finally(() => process.exit(0));
    });
  } catch (error) {
    if (embeddedHandle?.started) {
      await embeddedHandle.stop();
    }
    throw error;
  }
}

export function registerRunCommands(program: Command, context: CommandContext) {
  program
    .command("run")
    .description("Start the local PaperAI instance from the operating config")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .action(async (options) => {
      await runAction(context, options);
    });
}
