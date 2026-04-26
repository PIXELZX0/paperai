import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { CliError } from "../lib/errors.js";
import {
  getInstanceConfigPath,
  getPaperAiHomeDir,
  readInstanceConfig,
} from "../lib/config.js";
import { printJson } from "../lib/output.js";
import {
  applyDataDirOverride,
  ensurePaperAiHome,
  runProcess,
} from "../lib/ops.js";

type GatewayInstallOptions = {
  config?: string;
  dataDir?: string;
  binary?: string;
  dryRun?: boolean;
  enable?: boolean;
  serviceName?: string;
  start?: boolean;
  system?: boolean;
  unitDir?: string;
  workingDirectory?: string;
};

type InstallScope = "system" | "user";

function resolveServiceName(rawName: string | undefined): string {
  const name = rawName?.trim() || "paperai-gateway";
  const unitName = name.endsWith(".service") ? name : `${name}.service`;
  if (!/^[A-Za-z0-9_.@-]+\.service$/.test(unitName)) {
    throw new CliError(
      "service name must contain only letters, numbers, dot, underscore, dash, or @.",
    );
  }
  return unitName;
}

function getSystemdUserUnitDir(env: NodeJS.ProcessEnv): string {
  const configRoot =
    env.XDG_CONFIG_HOME ?? path.join(env.HOME ?? "", ".config");
  return path.resolve(configRoot, "systemd", "user");
}

function resolveUnitDir(
  env: NodeJS.ProcessEnv,
  options: GatewayInstallOptions,
): { scope: InstallScope; unitDir: string } {
  if (options.unitDir) {
    return {
      scope: options.system ? "system" : "user",
      unitDir: path.resolve(options.unitDir),
    };
  }

  if (options.system) {
    return {
      scope: "system",
      unitDir: "/etc/systemd/system",
    };
  }

  return {
    scope: "user",
    unitDir: getSystemdUserUnitDir(env),
  };
}

function quoteSystemdValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function formatExecStart(args: string[]): string {
  return args.map(quoteSystemdValue).join(" ");
}

function resolveWorkingDirectory(
  options: GatewayInstallOptions,
  config: PaperAiConfig | null,
): string {
  return path.resolve(
    options.workingDirectory ?? config?.repoRoot ?? process.cwd(),
  );
}

function buildGatewayUnit(input: {
  binary: string;
  configPath: string;
  dataDir: string;
  env: NodeJS.ProcessEnv;
  scope: InstallScope;
  workingDirectory: string;
}) {
  const environment = [
    ["NODE_ENV", "production"],
    ["PAPERAI_HOME", input.dataDir],
    ["PAPERAI_CONFIG", input.configPath],
    ...(input.env.PATH ? [["PATH", input.env.PATH]] : []),
  ];

  return [
    "[Unit]",
    "Description=PaperAI Gateway",
    "After=network-online.target",
    "Wants=network-online.target",
    "",
    "[Service]",
    "Type=simple",
    `WorkingDirectory=${quoteSystemdValue(input.workingDirectory)}`,
    ...environment.map(
      ([key, value]) => `Environment=${quoteSystemdValue(`${key}=${value}`)}`,
    ),
    `ExecStart=${formatExecStart([
      input.binary,
      "run",
      "--config",
      input.configPath,
      "--data-dir",
      input.dataDir,
    ])}`,
    "Restart=always",
    "RestartSec=5",
    "",
    "[Install]",
    `WantedBy=${input.scope === "system" ? "multi-user.target" : "default.target"}`,
    "",
  ].join("\n");
}

function buildSystemctlArgs(scope: InstallScope, args: string[]) {
  return scope === "user" ? ["--user", ...args] : args;
}

async function runSystemctl(
  context: CommandContext,
  scope: InstallScope,
  args: string[],
) {
  await runProcess(
    context.runtime,
    "systemctl",
    buildSystemctlArgs(scope, args),
    {
      env: context.runtime.env,
    },
  );
}

export async function gatewayInstallAction(
  context: CommandContext,
  options: GatewayInstallOptions,
) {
  applyDataDirOverride(context.runtime, options);
  await ensurePaperAiHome(context.runtime);

  const config = await readInstanceConfig(context.runtime.env);
  const dataDir = getPaperAiHomeDir(context.runtime.env);
  const configPath = getInstanceConfigPath(context.runtime.env);
  const unitName = resolveServiceName(options.serviceName);
  const { scope, unitDir } = resolveUnitDir(context.runtime.env, options);
  const unitPath = path.join(unitDir, unitName);
  const binary = options.binary?.trim() || context.runtime.invocationName;
  const workingDirectory = resolveWorkingDirectory(options, config);
  const unitContent = buildGatewayUnit({
    binary,
    configPath,
    dataDir,
    env: context.runtime.env,
    scope,
    workingDirectory,
  });
  const shouldEnable = options.enable !== false;
  const shouldRunSystemctl = !options.unitDir;
  const systemctlCommands = shouldRunSystemctl
    ? [
        buildSystemctlArgs(scope, ["daemon-reload"]),
        ...(shouldEnable
          ? [buildSystemctlArgs(scope, ["enable", unitName])]
          : []),
        ...(options.start
          ? [buildSystemctlArgs(scope, ["start", unitName])]
          : []),
      ]
    : [];

  if (!options.dryRun) {
    await mkdir(unitDir, { recursive: true });
    await writeFile(unitPath, unitContent);
    if (shouldRunSystemctl) {
      await runSystemctl(context, scope, ["daemon-reload"]);
      if (shouldEnable) {
        await runSystemctl(context, scope, ["enable", unitName]);
      }
      if (options.start) {
        await runSystemctl(context, scope, ["start", unitName]);
      }
    }
  }

  printJson(context.runtime, {
    ok: true,
    installed: options.dryRun ? false : true,
    scope,
    unitName,
    unitPath,
    unitContent,
    systemctlCommands,
    startCommand: `systemctl ${buildSystemctlArgs(scope, ["start", unitName]).join(" ")}`,
    statusCommand: `systemctl ${buildSystemctlArgs(scope, ["status", unitName]).join(" ")}`,
  });
}

export function registerGatewayCommands(
  program: Command,
  context: CommandContext,
) {
  const gateway = program
    .command("gateway")
    .description("Manage the local PaperAI gateway service");

  gateway
    .command("install")
    .description("Install the PaperAI gateway as a systemd service")
    .option("--config <path>", "path to the PaperAI instance config")
    .option(
      "--data-dir <path>",
      "PaperAI home directory (defaults to ~/.paperai)",
    )
    .option("--binary <path>", "binary or absolute command for ExecStart")
    .option("--dry-run", "print the unit without writing files or systemctl")
    .option("--no-enable", "write the unit without enabling it")
    .option("--service-name <name>", "systemd service name", "paperai-gateway")
    .option("--start", "start the service after installation")
    .option("--system", "install a system unit in /etc/systemd/system")
    .option("--unit-dir <path>", "override the systemd unit directory")
    .option("--working-directory <path>", "working directory for the service")
    .action(async (commandOptions) => {
      await gatewayInstallAction(
        context,
        commandOptions as GatewayInstallOptions,
      );
    });
}
