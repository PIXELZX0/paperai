import { randomUUID } from "node:crypto";
import { Command, Option } from "commander";
import pc from "picocolors";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import {
  defaultPaperAiConfig,
  getInstanceConfigPath,
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
  tui?: boolean;
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
};

type SetupMode = "quickstart" | "advanced";

type PromptApi = typeof import("@clack/prompts");

interface TuiModules {
  p: PromptApi;
}

function cloneConfig(base: PaperAiConfig): PaperAiConfig {
  return {
    ...base,
    database: { ...base.database, backup: { ...base.database.backup } },
    server: { ...base.server },
    gateway: { ...base.gateway },
    auth: { ...base.auth },
  };
}

function parsePositiveInteger(rawValue: string, label: string): number {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new CliError(`${label} must be a positive integer.`);
  }
  return value;
}

function parseUrl(rawValue: string, label: string): string {
  try {
    return new URL(rawValue).toString();
  } catch {
    throw new CliError(`${label} must be a valid URL.`);
  }
}

function ensureJwtSecret(config: PaperAiConfig): PaperAiConfig {
  const next = cloneConfig(config);
  if (next.server.jwtSecret === "change-me-paperai") {
    next.server.jwtSecret = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  }
  return next;
}

function mergeConfig(base: PaperAiConfig, options: OnboardOptions): PaperAiConfig {
  const next = cloneConfig(base);

  if (options.mode) {
    next.database.mode = options.mode;
    if (options.mode === "embedded-postgres") {
      next.database.connectionString = undefined;
    }
  }

  if (options.databaseUrl) {
    next.database.mode = "postgres";
    next.database.connectionString = options.databaseUrl.trim();
  }

  if (options.embeddedDataDir) {
    next.database.embeddedDataDir = options.embeddedDataDir;
  }

  if (options.embeddedPort) {
    next.database.embeddedPort = parsePositiveInteger(options.embeddedPort, "database.embeddedPort");
  }

  if (options.backupDir) {
    next.database.backup.dir = options.backupDir;
  }

  if (options.host) {
    next.server.host = options.host;
  }

  if (options.port) {
    next.server.port = parsePositiveInteger(options.port, "server.port");
  }

  if (options.webOrigin) {
    next.server.webOrigin = parseUrl(options.webOrigin, "server.webOrigin");
  }

  if (options.jwtSecret) {
    if (options.jwtSecret.length < 8) {
      throw new CliError("server.jwtSecret must be at least 8 characters.");
    }
    next.server.jwtSecret = options.jwtSecret;
  }

  if (options.gatewayUrl) {
    next.gateway.openclawUrl = parseUrl(options.gatewayUrl, "gateway.openclawUrl");
  }

  if (next.database.mode === "postgres" && !next.database.connectionString) {
    throw new CliError("database.connectionString is required when database.mode=postgres");
  }

  return next;
}

function isRuntimeTty(stream: unknown): boolean {
  if (!stream || typeof stream !== "object") {
    return false;
  }
  return "isTTY" in stream && (stream as { isTTY?: boolean }).isTTY === true;
}

function shouldUseTui(context: CommandContext, options: OnboardOptions): boolean {
  if (options.tui === false || options.yes === true) {
    return false;
  }
  return context.runtime.stdin.isTTY === true && isRuntimeTty(context.runtime.stdout);
}

function validateRequired(value: string | undefined, label: string): string | undefined {
  if ((value ?? "").trim().length === 0) {
    return `${label} is required.`;
  }
  return undefined;
}

function validatePositiveInteger(value: string | undefined, label: string): string | undefined {
  try {
    parsePositiveInteger((value ?? "").trim(), label);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : `${label} must be a positive integer.`;
  }
}

function validateUrl(value: string | undefined, label: string): string | undefined {
  try {
    parseUrl((value ?? "").trim(), label);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : `${label} must be a valid URL.`;
  }
}

async function loadTuiModules(): Promise<TuiModules> {
  const prompts = await import("@clack/prompts");
  return {
    p: prompts,
  };
}

async function promptOnboardConfig(
  tui: TuiModules,
  configPath: string,
  baseConfig: PaperAiConfig,
  hasExistingConfig: boolean,
): Promise<PaperAiConfig | null> {
  const { p } = tui;
  const next = cloneConfig(baseConfig);

  p.intro(pc.bgCyan(pc.black(" paperai onboard ")));
  p.log.message(pc.dim(`Config path: ${configPath}`));
  if (hasExistingConfig) {
    p.log.message(pc.dim("Existing config detected. Quickstart keeps the current values."));
  }

  const setupModeChoice = await p.select({
    message: "Choose setup path",
    options: [
      {
        value: "quickstart" as const,
        label: "Quickstart",
        hint: "Recommended: keep defaults and continue",
      },
      {
        value: "advanced" as const,
        label: "Advanced setup",
        hint: "Configure database, server, auth, and gateway",
      },
    ],
    initialValue: "quickstart",
  });

  if (p.isCancel(setupModeChoice)) {
    p.cancel("Onboarding cancelled.");
    return null;
  }

  const setupMode = setupModeChoice as SetupMode;

  if (setupMode === "advanced") {
    p.log.step(pc.bold("Database"));
    const databaseMode = await p.select({
      message: "Database mode",
      options: [
        {
          value: "embedded-postgres" as const,
          label: "Embedded Postgres",
          hint: "Run Postgres inside PaperAI",
        },
        {
          value: "postgres" as const,
          label: "External Postgres",
          hint: "Use your own Postgres connection string",
        },
      ],
      initialValue: next.database.mode,
    });
    if (p.isCancel(databaseMode)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.database.mode = databaseMode as PaperAiConfig["database"]["mode"];

    if (next.database.mode === "postgres") {
      const connectionString = await p.text({
        message: "Postgres connection string",
        initialValue: next.database.connectionString ?? "postgres://user:pass@localhost:5432/paperai",
        validate: (value) => validateRequired(value, "database.connectionString"),
      });
      if (p.isCancel(connectionString)) {
        p.cancel("Onboarding cancelled.");
        return null;
      }
      next.database.connectionString = String(connectionString).trim();
    } else {
      next.database.connectionString = undefined;

      const embeddedDataDir = await p.text({
        message: "Embedded Postgres data directory",
        initialValue: next.database.embeddedDataDir,
        validate: (value) => validateRequired(value, "database.embeddedDataDir"),
      });
      if (p.isCancel(embeddedDataDir)) {
        p.cancel("Onboarding cancelled.");
        return null;
      }
      next.database.embeddedDataDir = String(embeddedDataDir).trim();

      const embeddedPort = await p.text({
        message: "Embedded Postgres port",
        initialValue: String(next.database.embeddedPort),
        validate: (value) => validatePositiveInteger(value, "database.embeddedPort"),
      });
      if (p.isCancel(embeddedPort)) {
        p.cancel("Onboarding cancelled.");
        return null;
      }
      next.database.embeddedPort = parsePositiveInteger(String(embeddedPort ?? ""), "database.embeddedPort");
    }

    const backupDir = await p.text({
      message: "Database backup directory",
      initialValue: next.database.backup.dir,
      validate: (value) => validateRequired(value, "database.backup.dir"),
    });
    if (p.isCancel(backupDir)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.database.backup.dir = String(backupDir).trim();

    p.log.step(pc.bold("Server"));
    const host = await p.text({
      message: "Server host",
      initialValue: next.server.host,
      validate: (value) => validateRequired(value, "server.host"),
    });
    if (p.isCancel(host)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.server.host = String(host).trim();

    const port = await p.text({
      message: "Server port",
      initialValue: String(next.server.port),
      validate: (value) => validatePositiveInteger(value, "server.port"),
    });
    if (p.isCancel(port)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.server.port = parsePositiveInteger(String(port ?? ""), "server.port");

    const webOrigin = await p.text({
      message: "Web origin",
      initialValue: next.server.webOrigin,
      validate: (value) => validateUrl(value, "server.webOrigin"),
    });
    if (p.isCancel(webOrigin)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.server.webOrigin = parseUrl(String(webOrigin ?? ""), "server.webOrigin");

    const jwtSecret = await p.text({
      message: "JWT secret",
      initialValue: next.server.jwtSecret,
      validate: (value) => {
        if ((value ?? "").trim().length < 8) {
          return "server.jwtSecret must be at least 8 characters.";
        }
        return undefined;
      },
    });
    if (p.isCancel(jwtSecret)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.server.jwtSecret = String(jwtSecret ?? "").trim();

    p.log.step(pc.bold("Auth"));
    const boardClaimTtl = await p.text({
      message: "Board claim TTL minutes",
      initialValue: String(next.auth.boardClaimTtlMinutes),
      validate: (value) => validatePositiveInteger(value, "auth.boardClaimTtlMinutes"),
    });
    if (p.isCancel(boardClaimTtl)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.auth.boardClaimTtlMinutes = parsePositiveInteger(String(boardClaimTtl ?? ""), "auth.boardClaimTtlMinutes");

    const cliChallengeTtl = await p.text({
      message: "CLI challenge TTL minutes",
      initialValue: String(next.auth.cliChallengeTtlMinutes),
      validate: (value) => validatePositiveInteger(value, "auth.cliChallengeTtlMinutes"),
    });
    if (p.isCancel(cliChallengeTtl)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.auth.cliChallengeTtlMinutes = parsePositiveInteger(String(cliChallengeTtl ?? ""), "auth.cliChallengeTtlMinutes");

    const agentTokenTtl = await p.text({
      message: "Agent token TTL minutes",
      initialValue: String(next.auth.agentTokenTtlMinutes),
      validate: (value) => validatePositiveInteger(value, "auth.agentTokenTtlMinutes"),
    });
    if (p.isCancel(agentTokenTtl)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.auth.agentTokenTtlMinutes = parsePositiveInteger(String(agentTokenTtl ?? ""), "auth.agentTokenTtlMinutes");

    p.log.step(pc.bold("Gateway"));
    const gatewayUrl = await p.text({
      message: "OpenClaw gateway execute URL",
      initialValue: next.gateway.openclawUrl,
      validate: (value) => validateUrl(value, "gateway.openclawUrl"),
    });
    if (p.isCancel(gatewayUrl)) {
      p.cancel("Onboarding cancelled.");
      return null;
    }
    next.gateway.openclawUrl = parseUrl(String(gatewayUrl ?? ""), "gateway.openclawUrl");
  } else {
    p.log.step(pc.bold("Quickstart"));
    p.log.message(pc.dim("Keeping defaults/current values."));
  }

  return next;
}

function printTuiSummary(
  tui: TuiModules,
  config: PaperAiConfig,
  configPath: string,
  apiUrl: string,
  profilePath: string,
) {
  const { p } = tui;
  p.note(
    [
      `Config path: ${configPath}`,
      `Profile path: ${profilePath}`,
      `API URL: ${apiUrl}`,
      `Database: ${config.database.mode}`,
      `Server: ${config.server.host}:${config.server.port}`,
      `Gateway: ${config.gateway.openclawUrl}`,
    ].join("\n"),
    "Configuration saved",
  );

  p.note(
    [
      "Run: paperai run",
      "Reconfigure: paperai configure --section <database|server|gateway|auth>",
      "Diagnostics: paperai doctor",
    ].join("\n"),
    "Next commands",
  );
}

export async function onboardAction(context: CommandContext, options: OnboardOptions) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const configPath = getInstanceConfigPath(context.runtime.env);
  const existing = await readInstanceConfig(context.runtime.env);
  const baseConfig = mergeConfig(existing ?? defaultPaperAiConfig(context.runtime.env), options);

  const useTui = shouldUseTui(context, options);
  const tui = useTui ? await loadTuiModules() : null;

  let configured = baseConfig;

  if (tui) {
    const prompted = await promptOnboardConfig(tui, configPath, baseConfig, existing !== null);
    if (!prompted) {
      return;
    }
    configured = prompted;
  }

  const config = ensureJwtSecret(configured);
  const persistedConfigPath = await writeInstanceConfig(context.runtime.env, config);
  const apiUrl = resolveApiUrlFromConfig(config);

  const profile = await context.loadProfile();
  const profilePath = await context.saveProfile({
    ...profile,
    apiUrl,
  });

  let shouldRunNow = options.run === true || options.yes === true;
  if (tui && !shouldRunNow) {
    const answer = await tui.p.confirm({
      message: "Start PaperAI now?",
      initialValue: true,
    });
    if (tui.p.isCancel(answer)) {
      tui.p.cancel("Onboarding cancelled.");
      return;
    }
    shouldRunNow = Boolean(answer);
  }

  if (shouldRunNow) {
    const { runAction } = await import("./run.js");
    await runAction(context, {
      config: options.config,
      dataDir: options.dataDir,
      skipOnboard: true,
    });
    return;
  }

  if (tui) {
    printTuiSummary(tui, config, persistedConfigPath, apiUrl, profilePath);
    tui.p.outro("You're all set!");
    return;
  }

  printJson(context.runtime, {
    ok: true,
    configPath: persistedConfigPath,
    profilePath,
    apiUrl,
    databaseMode: config.database.mode,
    embeddedDataDir: config.database.mode === "embedded-postgres" ? config.database.embeddedDataDir : null,
    gatewayUrl: config.gateway.openclawUrl,
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
    .option("--no-tui", "disable interactive onboarding prompts")
    .addOption(new Option("--mode <mode>", "database mode").choices(["embedded-postgres", "postgres"]))
    .option("--database-url <url>", "external Postgres connection string")
    .option("--embedded-data-dir <path>", "embedded Postgres data directory")
    .option("--embedded-port <port>", "embedded Postgres TCP port")
    .option("--backup-dir <path>", "database backup directory")
    .option("--host <host>", "server host")
    .option("--port <port>", "server port")
    .option("--web-origin <url>", "web origin allowed by CORS")
    .option("--jwt-secret <secret>", "JWT secret for local auth")
    .option("--gateway-url <url>", "OpenClaw gateway execute URL")
    .action(async (commandOptions) => {
      await onboardAction(context, commandOptions as OnboardOptions);
    });
}
