import { randomUUID } from "node:crypto";
import { Command } from "commander";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import {
  defaultPaperAiConfig,
  readInstanceConfig,
  writeInstanceConfig,
} from "../lib/config.js";
import { printJson } from "../lib/output.js";
import { applyDataDirOverride, ensurePaperAiHome, resolveApiUrlFromConfig } from "../lib/ops.js";

type OnboardOptions = {
  config?: string;
  dataDir?: string;
  yes?: boolean;
  run?: boolean;
  databaseUrl?: string;
  host?: string;
  port?: string;
  webOrigin?: string;
  jwtSecret?: string;
};

function mergeConfig(base: PaperAiConfig, options: OnboardOptions): PaperAiConfig {
  const next: PaperAiConfig = {
    ...base,
    database: { ...base.database, backup: { ...base.database.backup } },
    server: { ...base.server },
    auth: { ...base.auth },
  };

  if (options.databaseUrl) {
    next.database.mode = "postgres";
    next.database.connectionString = options.databaseUrl;
  }

  if (options.host) {
    next.server.host = options.host;
  }

  if (options.port) {
    next.server.port = Number(options.port);
  }

  if (options.webOrigin) {
    next.server.webOrigin = options.webOrigin;
  }

  if (options.jwtSecret) {
    next.server.jwtSecret = options.jwtSecret;
  }

  if (next.server.jwtSecret === "change-me-paperai") {
    next.server.jwtSecret = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  }

  return next;
}

export async function onboardAction(context: CommandContext, options: OnboardOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const existing = await readInstanceConfig(context.runtime.env);
  const config = mergeConfig(existing ?? defaultPaperAiConfig(context.runtime.env), options);
  const configPath = await writeInstanceConfig(context.runtime.env, config);
  const apiUrl = resolveApiUrlFromConfig(config);

  const profile = await context.loadProfile();
  await context.saveProfile({
    ...profile,
    apiUrl,
  });

  if (options.run || options.yes) {
    const { runAction } = await import("./run.js");
    await runAction(context, {
      config: options.config,
      dataDir: options.dataDir,
      skipOnboard: true,
    });
    return;
  }

  printJson(context.runtime, {
    ok: true,
    configPath,
    apiUrl,
    databaseMode: config.database.mode,
    embeddedDataDir: config.database.mode === "embedded-postgres" ? config.database.embeddedDataDir : null,
  });
}

export function registerOnboardCommands(program: Command, context: CommandContext) {
  program
    .command("onboard")
    .description("Create or refresh the local PaperAI instance config")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .option("-y, --yes", "accept defaults and start the local instance")
    .option("--run", "start the local instance after writing config")
    .option("--database-url <url>", "use an external Postgres connection string")
    .option("--host <host>", "server host")
    .option("--port <port>", "server port")
    .option("--web-origin <url>", "web origin allowed by CORS")
    .option("--jwt-secret <secret>", "JWT secret for local auth")
    .action(async (options) => {
      await onboardAction(context, options);
    });
}
