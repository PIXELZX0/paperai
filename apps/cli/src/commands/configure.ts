import { Command, Option } from "commander";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import {
  defaultPaperAiConfig,
  readInstanceConfig,
  writeInstanceConfig,
} from "../lib/config.js";
import { printJson } from "../lib/output.js";
import { applyDataDirOverride, ensurePaperAiHome, resolveApiUrlFromConfig } from "../lib/ops.js";

type ConfigureOptions = {
  config?: string;
  dataDir?: string;
  section: "database" | "server" | "gateway" | "auth";
  mode?: "embedded-postgres" | "postgres";
  databaseUrl?: string;
  embeddedDataDir?: string;
  embeddedPort?: string;
  backupDir?: string;
  host?: string;
  port?: string;
  webOrigin?: string;
  jwtSecret?: string;
  gatewayUrl?: string;
  boardClaimTtlMinutes?: string;
  cliChallengeTtlMinutes?: string;
  agentTokenTtlMinutes?: string;
};

function updateConfig(config: PaperAiConfig, options: ConfigureOptions): PaperAiConfig {
  const next: PaperAiConfig = {
    ...config,
    database: { ...config.database, backup: { ...config.database.backup } },
    server: { ...config.server },
    gateway: { ...config.gateway },
    auth: { ...config.auth },
  };

  if (options.section === "database") {
    if (options.mode) {
      next.database.mode = options.mode;
    }
    if (options.databaseUrl !== undefined) {
      next.database.connectionString = options.databaseUrl;
    }
    if (options.embeddedDataDir) {
      next.database.embeddedDataDir = options.embeddedDataDir;
    }
    if (options.embeddedPort) {
      next.database.embeddedPort = Number(options.embeddedPort);
    }
    if (options.backupDir) {
      next.database.backup.dir = options.backupDir;
    }
  }

  if (options.section === "server") {
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
  }

  if (options.section === "gateway") {
    if (options.gatewayUrl) {
      next.gateway.openclawUrl = options.gatewayUrl;
    }
  }

  if (options.section === "auth") {
    if (options.boardClaimTtlMinutes) {
      next.auth.boardClaimTtlMinutes = Number(options.boardClaimTtlMinutes);
    }
    if (options.cliChallengeTtlMinutes) {
      next.auth.cliChallengeTtlMinutes = Number(options.cliChallengeTtlMinutes);
    }
    if (options.agentTokenTtlMinutes) {
      next.auth.agentTokenTtlMinutes = Number(options.agentTokenTtlMinutes);
    }
  }

  if (next.database.mode === "postgres" && !next.database.connectionString) {
    throw new CliError("database.connectionString is required when database.mode=postgres");
  }

  return next;
}

export async function configureAction(context: CommandContext, options: ConfigureOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const current = (await readInstanceConfig(context.runtime.env)) ?? defaultPaperAiConfig(context.runtime.env);
  const next = updateConfig(current, options);
  const configPath = await writeInstanceConfig(context.runtime.env, next);

  const profile = await context.loadProfile();
  await context.saveProfile({
    ...profile,
    apiUrl: resolveApiUrlFromConfig(next),
  });

  printJson(context.runtime, {
    ok: true,
    configPath,
    section: options.section,
    config: next[options.section],
  });
}

export function registerConfigureCommands(program: Command, context: CommandContext) {
  program
    .command("configure")
    .description("Update one PaperAI config section")
    .requiredOption("--section <section>", "config section to update")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .addOption(new Option("--mode <mode>", "database mode").choices(["embedded-postgres", "postgres"]))
    .option("--database-url <url>", "external Postgres connection string")
    .option("--embedded-data-dir <path>", "embedded Postgres data directory")
    .option("--embedded-port <port>", "embedded Postgres TCP port")
    .option("--backup-dir <path>", "database backup directory")
    .option("--host <host>", "server host")
    .option("--port <port>", "server port")
    .option("--web-origin <url>", "allowed web origin")
    .option("--jwt-secret <secret>", "JWT secret")
    .option("--gateway-url <url>", "OpenClaw gateway execute URL")
    .option("--board-claim-ttl-minutes <minutes>", "board claim token TTL")
    .option("--cli-challenge-ttl-minutes <minutes>", "CLI auth challenge TTL")
    .option("--agent-token-ttl-minutes <minutes>", "agent token TTL")
    .action(async (options) => {
      await configureAction(context, options as ConfigureOptions);
    });
}
