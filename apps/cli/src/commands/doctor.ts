import { Command } from "commander";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import {
  getInstanceConfigPath,
  getPaperAiHomeDir,
  readInstanceConfig,
} from "../lib/config.js";
import { printJson } from "../lib/output.js";
import {
  applyDataDirOverride,
  ensurePgDumpAvailable,
  readDirectorySummary,
  resolveApiUrlFromConfig,
} from "../lib/ops.js";

type DoctorCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
};

type DoctorOptions = {
  config?: string;
  dataDir?: string;
};

async function checkHealth(context: CommandContext, config: PaperAiConfig): Promise<DoctorCheck> {
  const url = `${resolveApiUrlFromConfig(config).replace(/\/api\/v1$/, "")}/health`;

  try {
    const response = await context.runtime.fetchImpl(url);
    if (!response.ok) {
      return {
        name: "server_health",
        status: "warn",
        message: `Server reachable but /health returned ${response.status}`,
      };
    }

    return {
      name: "server_health",
      status: "pass",
      message: `${url} reachable`,
    };
  } catch {
    return {
      name: "server_health",
      status: "warn",
      message: `${url} is not reachable`,
    };
  }
}

export async function doctorAction(context: CommandContext, options: DoctorOptions) {
  applyDataDirOverride(context.runtime, options);

  const configPath = getInstanceConfigPath(context.runtime.env);
  const homeDir = getPaperAiHomeDir(context.runtime.env);
  const config = await readInstanceConfig(context.runtime.env);
  const checks: DoctorCheck[] = [
    {
      name: "paperai_home",
      status: "pass",
      message: await readDirectorySummary(homeDir),
    },
  ];

  if (!config) {
    checks.push({
      name: "config",
      status: "fail",
      message: `No config found at ${configPath}`,
    });
    printJson(context.runtime, summarizeDoctor(checks));
    return;
  }

  checks.push({
    name: "config",
    status: "pass",
    message: `Loaded config from ${configPath}`,
  });

  if (config.database.mode === "embedded-postgres") {
    checks.push({
      name: "database_mode",
      status: "pass",
      message: `embedded-postgres configured at ${config.database.embeddedDataDir}:${config.database.embeddedPort}`,
    });
  } else {
    checks.push({
      name: "database_mode",
      status: config.database.connectionString ? "pass" : "fail",
      message: config.database.connectionString
        ? "external postgres connection string configured"
        : "database.connectionString missing for postgres mode",
    });
  }

  checks.push({
    name: "backup_dir",
    status: "pass",
    message: await readDirectorySummary(config.database.backup.dir),
  });

  try {
    await ensurePgDumpAvailable(context.runtime);
    checks.push({
      name: "pg_dump",
      status: "pass",
      message: "pg_dump is available",
    });
  } catch (error) {
    checks.push({
      name: "pg_dump",
      status: "warn",
      message: error instanceof Error ? error.message : "pg_dump unavailable",
    });
  }

  checks.push(await checkHealth(context, config));
  printJson(context.runtime, summarizeDoctor(checks));
}

function summarizeDoctor(checks: DoctorCheck[]) {
  return {
    checks,
    passed: checks.filter((check) => check.status === "pass").length,
    warned: checks.filter((check) => check.status === "warn").length,
    failed: checks.filter((check) => check.status === "fail").length,
  };
}

export function registerDoctorCommands(program: Command, context: CommandContext) {
  program
    .command("doctor")
    .description("Inspect the local PaperAI operating setup")
    .option("--config <path>", "path to the PaperAI instance config")
    .option("--data-dir <path>", "PaperAI home directory (defaults to ~/.paperai)")
    .action(async (options) => {
      await doctorAction(context, options);
    });
}
