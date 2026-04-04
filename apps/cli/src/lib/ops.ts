import { access, mkdir, stat } from "node:fs/promises";
import { constants as fsConstants, existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { PaperAiConfig } from "@paperai/shared";
import { ensureEmbeddedPostgres, type EmbeddedPostgresHandle } from "@paperai/db";
import type { CliRuntime } from "./runtime.js";
import { CliError } from "./errors.js";
import { getInstanceConfigPath, getPaperAiHomeDir } from "./config.js";

export interface OpsOptionsLike {
  config?: string;
  dataDir?: string;
}

export function applyDataDirOverride(runtime: CliRuntime, options: OpsOptionsLike) {
  const rawConfigPath = options.config?.trim();
  if (rawConfigPath) {
    runtime.env.PAPERAI_CONFIG = path.resolve(rawConfigPath);
  }

  const rawDataDir = options.dataDir?.trim();
  if (!rawDataDir) {
    if (!runtime.env.PAPERAI_CONFIG) {
      runtime.env.PAPERAI_CONFIG = getInstanceConfigPath(runtime.env);
    }
    return;
  }

  const homeDir = path.resolve(rawDataDir);
  runtime.env.PAPERAI_HOME = homeDir;

  if (!options.config && !runtime.env.PAPERAI_CONFIG) {
    runtime.env.PAPERAI_CONFIG = path.join(homeDir, "config.json");
  }
}

export function resolveApiUrlFromConfig(config: PaperAiConfig): string {
  return `http://${config.server.host === "0.0.0.0" ? "127.0.0.1" : config.server.host}:${config.server.port}/api/v1`;
}

function findWorkspaceRoot(start: string): string | null {
  let current = path.resolve(start);

  while (true) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveRepoRoot(env: NodeJS.ProcessEnv = process.env): string {
  const overrideRoot = env.PAPERAI_REPO_ROOT?.trim();
  if (overrideRoot) {
    const resolved = path.resolve(overrideRoot);
    const workspaceRoot = findWorkspaceRoot(resolved);
    if (!workspaceRoot || workspaceRoot !== resolved) {
      throw new CliError(
        `PAPERAI_REPO_ROOT must point to a PaperAI workspace root containing pnpm-workspace.yaml (received: ${resolved}).`,
      );
    }
    return resolved;
  }

  const cwdWorkspace = findWorkspaceRoot(process.cwd());
  if (cwdWorkspace) {
    return cwdWorkspace;
  }

  const moduleWorkspace = findWorkspaceRoot(path.dirname(fileURLToPath(import.meta.url)));
  if (moduleWorkspace) {
    return moduleWorkspace;
  }

  throw new CliError(
    "Could not locate the PaperAI workspace. Run this command from the PaperAI repository root or set PAPERAI_REPO_ROOT=/absolute/path/to/paperai.",
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureWritableDirectory(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
  await access(dirPath, fsConstants.W_OK);
}

export async function ensureEmbeddedDatabase(
  config: PaperAiConfig,
  runtime: CliRuntime,
): Promise<EmbeddedPostgresHandle | null> {
  if (config.database.mode !== "embedded-postgres") {
    runtime.env.DATABASE_URL = config.database.connectionString;
    return null;
  }

  const handle = await ensureEmbeddedPostgres({
    dataDir: config.database.embeddedDataDir,
    preferredPort: config.database.embeddedPort,
    databaseName: "paperai",
    user: "paperai",
    password: "paperai",
    onLog: (message) => {
      if (message.trim()) {
        runtime.stderr.write(`[embedded-postgres] ${message.trim()}\n`);
      }
    },
  });
  runtime.env.DATABASE_URL = handle.connectionString;
  return handle;
}

export async function runProcess(
  runtime: CliRuntime,
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    stdout?: "inherit" | "pipe";
  } = {},
): Promise<{ stdout: string }> {
  const stdoutMode = options.stdout ?? "inherit";

  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", stdoutMode === "inherit" ? "inherit" : "pipe", "inherit"],
    });

    let stdout = "";
    if (stdoutMode === "pipe" && child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new CliError(`Command failed: ${command} ${args.join(" ")}`, code ?? 1));
        return;
      }
      resolve({ stdout });
    });
  });
}

export async function ensureDatabaseSchema(runtime: CliRuntime) {
  const repoRoot = resolveRepoRoot(runtime.env);
  await runProcess(runtime, "pnpm", ["db:push"], {
    cwd: repoRoot,
    env: runtime.env,
  });
}

export async function ensureWebBuild(runtime: CliRuntime, options: { force?: boolean } = {}) {
  const repoRoot = resolveRepoRoot(runtime.env);
  const webDistDir = path.join(repoRoot, "apps/web/dist/index.html");
  if (!options.force && (await pathExists(webDistDir))) {
    return;
  }

  const webPackage = path.join(repoRoot, "apps/web/package.json");
  if (!(await pathExists(webPackage))) {
    return;
  }

  await runProcess(runtime, "pnpm", ["--filter", "@paperai/web", "build"], {
    cwd: repoRoot,
    env: runtime.env,
  });
}

export async function resolveBackupPath(config: PaperAiConfig, fileName?: string): Promise<string> {
  const dir = config.database.backup.dir;
  await ensureWritableDirectory(dir);
  if (fileName && path.isAbsolute(fileName)) {
    await ensureWritableDirectory(path.dirname(fileName));
    return fileName;
  }
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  return path.join(dir, fileName ?? `paperai-${timestamp}.sql`);
}

export async function ensurePgDumpAvailable(runtime: CliRuntime) {
  try {
    await runProcess(runtime, "pg_dump", ["--version"], {
      stdout: "pipe",
    });
  } catch {
    throw new CliError("`pg_dump` is required for `paperai db:backup` but was not found in PATH.");
  }
}

export async function createDatabaseBackup(runtime: CliRuntime, connectionString: string, outputPath: string) {
  await runProcess(runtime, "pg_dump", ["--dbname", connectionString, "--file", outputPath], {
    env: runtime.env,
  });
}

export async function ensurePaperAiHome(runtime: CliRuntime) {
  await ensureWritableDirectory(getPaperAiHomeDir(runtime.env));
}

export async function readDirectorySummary(targetPath: string): Promise<string> {
  try {
    const info = await stat(targetPath);
    if (info.isDirectory()) {
      return `${targetPath} (directory)`;
    }
    if (info.isFile()) {
      return `${targetPath} (file)`;
    }
    return `${targetPath} (other)`;
  } catch {
    return `${targetPath} (missing)`;
  }
}
