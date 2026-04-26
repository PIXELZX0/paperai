import { access, mkdir, readdir, rm, stat } from "node:fs/promises";
import {
  constants as fsConstants,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import type { PaperAiConfig } from "@paperai/shared";
import {
  ensureEmbeddedPostgres,
  type EmbeddedPostgresHandle,
} from "@paperai/db";
import type { CliRuntime } from "./runtime.js";
import { CliError } from "./errors.js";
import { getInstanceConfigPath, getPaperAiHomeDir } from "./config.js";

export interface OpsOptionsLike {
  config?: string;
  dataDir?: string;
}

const DEFAULT_PNPM_WORKSPACE_YAML = [
  "packages:",
  "  - apps/*",
  "  - packages/*",
  "  - packages/adapters/*",
  "",
].join("\n");

const DEFAULT_PAPERAI_REPO_URL = "https://github.com/PIXELZX0/paperai.git";
const PAPERAI_ROOT_SENTINEL = path.join("apps", "server", "package.json");

function isPaperAiRepoRoot(repoRoot: string): boolean {
  const resolved = path.resolve(repoRoot);
  const workspaceManifest = path.join(resolved, "pnpm-workspace.yaml");
  const packageJsonPath = path.join(resolved, "package.json");
  const sentinelPath = path.join(resolved, PAPERAI_ROOT_SENTINEL);

  if (
    !existsSync(workspaceManifest) ||
    !existsSync(packageJsonPath) ||
    !existsSync(sentinelPath)
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
      private?: unknown;
    };
    return parsed.name === "paperai" && parsed.private === true;
  } catch {
    return false;
  }
}

export function applyDataDirOverride(
  runtime: CliRuntime,
  options: OpsOptionsLike,
) {
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
    if (isPaperAiRepoRoot(current)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function validateRepoRootPath(repoRoot: string, source: string): string {
  const resolved = path.resolve(repoRoot.trim());
  const workspaceRoot = findWorkspaceRoot(resolved);
  if (!workspaceRoot || workspaceRoot !== resolved) {
    throw new CliError(
      `${source} must point to a PaperAI repository checkout root containing pnpm-workspace.yaml, package.json, and ${PAPERAI_ROOT_SENTINEL} (received: ${resolved}).`,
    );
  }
  return resolved;
}

export function validateRepoRootCandidatePath(
  repoRoot: string,
  source: string,
): string {
  const resolved = path.resolve(repoRoot.trim());
  const workspaceRoot = findWorkspaceRoot(resolved);

  if (workspaceRoot === resolved) {
    return resolved;
  }

  let stats: ReturnType<typeof statSync>;
  try {
    stats = statSync(resolved);
  } catch {
    return resolved;
  }

  if (!stats.isDirectory()) {
    throw new CliError(
      `${source} must point to a directory (received: ${resolved}).`,
    );
  }

  const entries = readdirSync(resolved);
  if (entries.length === 0 || isRecoverableStubWorkspace(entries, resolved)) {
    return resolved;
  }

  throw new CliError(
    `${source} must point to an existing PaperAI checkout, an empty directory, or a recoverable PaperAI bootstrap directory (received: ${resolved}).`,
  );
}

function isRecoverableStubWorkspace(
  entries: string[],
  repoRoot: string,
): boolean {
  if (entries.length !== 1 || entries[0] !== "pnpm-workspace.yaml") {
    return false;
  }

  const manifestPath = path.join(repoRoot, "pnpm-workspace.yaml");
  try {
    return readFileSync(manifestPath, "utf8") === DEFAULT_PNPM_WORKSPACE_YAML;
  } catch {
    return false;
  }
}

async function clonePaperAiCheckout(
  runtime: CliRuntime,
  repoRoot: string,
  repoUrl: string,
) {
  await mkdir(path.dirname(repoRoot), { recursive: true });
  await runProcess(
    runtime,
    "git",
    ["clone", "--depth", "1", repoUrl, repoRoot],
    {
      env: runtime.env,
    },
  );

  if (!isPaperAiRepoRoot(repoRoot)) {
    throw new CliError(
      `Cloned repository is not a valid PaperAI checkout root: ${repoRoot}`,
    );
  }
}

export async function ensurePaperAiCheckout(
  runtime: CliRuntime,
  repoRoot: string,
  options: { repoUrl?: string } = {},
): Promise<string> {
  const resolved = path.resolve(repoRoot.trim());
  const repoUrl = options.repoUrl ?? DEFAULT_PAPERAI_REPO_URL;

  if (isPaperAiRepoRoot(resolved)) {
    return resolved;
  }

  try {
    const existing = statSync(resolved);
    if (!existing.isDirectory()) {
      throw new CliError(
        `PaperAI repository checkout root must be a directory (received: ${resolved}).`,
      );
    }
  } catch (error) {
    if (
      !(error instanceof CliError) &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      await clonePaperAiCheckout(runtime, resolved, repoUrl);
      return resolved;
    }
    throw error;
  }

  const entries = await readdir(resolved);
  if (entries.length === 0) {
    await clonePaperAiCheckout(runtime, resolved, repoUrl);
    return resolved;
  }

  if (isRecoverableStubWorkspace(entries, resolved)) {
    await rm(resolved, { recursive: true, force: true });
    await clonePaperAiCheckout(runtime, resolved, repoUrl);
    return resolved;
  }

  throw new CliError(
    `PaperAI repository checkout root must be an existing PaperAI checkout or an empty directory. The target is non-empty and cannot be recovered automatically: ${resolved}`,
  );
}

function readRepoRootFromConfig(configPath: string): string | null {
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as {
      repoRoot?: unknown;
    };
    if (
      typeof parsed.repoRoot === "string" &&
      parsed.repoRoot.trim().length > 0
    ) {
      return parsed.repoRoot.trim();
    }
  } catch {
    // Ignore malformed config and continue with other resolution paths.
  }

  return null;
}

function listFallbackRepoRoots(env: NodeJS.ProcessEnv): string[] {
  const candidates = new Set<string>();
  const addCandidate = (candidate?: string) => {
    const value = candidate?.trim();
    if (!value) {
      return;
    }
    candidates.add(path.resolve(value));
  };

  addCandidate(env.PWD);

  const invokedScript = process.argv[1] ? path.resolve(process.argv[1]) : "";
  if (invokedScript) {
    const invocationName = path.basename(invokedScript);
    if (
      invocationName === "paperai" ||
      invocationName === "papercli" ||
      invocationName.startsWith("index.")
    ) {
      addCandidate(path.dirname(invokedScript));
    }
  }

  const homeDir = env.HOME?.trim();
  if (homeDir) {
    const home = path.resolve(homeDir);
    const homeCandidates = [
      "paperai",
      "workspace/paperai",
      "workspaces/paperai",
      "projects/paperai",
      "project/paperai",
      "code/paperai",
      "src/paperai",
      "Desktop/paperai",
      "Desktop/projects/paperai",
      "Desktop/Projects/paperai",
      "Desktop/프로젝트/paperai",
    ];
    for (const relativePath of homeCandidates) {
      addCandidate(path.join(home, relativePath));
    }
  }

  return [...candidates];
}

export function resolveRepoRoot(env: NodeJS.ProcessEnv = process.env): string {
  const overrideRoot = env.PAPERAI_REPO_ROOT?.trim();
  if (overrideRoot) {
    return validateRepoRootPath(overrideRoot, "PAPERAI_REPO_ROOT");
  }

  const configPath = getInstanceConfigPath(env);
  const configuredRepoRoot = readRepoRootFromConfig(configPath);
  if (configuredRepoRoot) {
    return validateRepoRootPath(
      configuredRepoRoot,
      `config.repoRoot (${configPath})`,
    );
  }

  const cwdWorkspace = findWorkspaceRoot(process.cwd());
  if (cwdWorkspace) {
    return cwdWorkspace;
  }

  for (const fallbackCandidate of listFallbackRepoRoots(env)) {
    const discoveredWorkspace = findWorkspaceRoot(fallbackCandidate);
    if (discoveredWorkspace) {
      return discoveredWorkspace;
    }
  }

  throw new CliError(
    "Could not locate the PaperAI repository checkout. Run this command from the PaperAI repository root or set PAPERAI_REPO_ROOT=/absolute/path/to/paperai.",
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

function repoBinPath(repoRoot: string, binaryName: string): string {
  return path.join(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? `${binaryName}.cmd` : binaryName,
  );
}

async function ensureWorkspaceDependencies(
  runtime: CliRuntime,
  repoRoot: string,
  options: { webBuild?: boolean } = {},
) {
  const requiredPaths = [
    path.join(repoRoot, "node_modules", ".modules.yaml"),
    repoBinPath(repoRoot, "drizzle-kit"),
  ];

  if (options.webBuild) {
    requiredPaths.push(path.join(repoRoot, "apps", "web", "node_modules"));
    requiredPaths.push(repoBinPath(path.join(repoRoot, "apps", "web"), "vite"));
  }

  const hasRequiredDependencies = (
    await Promise.all(requiredPaths.map((targetPath) => pathExists(targetPath)))
  ).every(Boolean);
  if (hasRequiredDependencies) {
    return;
  }

  runtime.stderr.write(
    `PaperAI repository dependencies are missing; running pnpm install --frozen-lockfile in ${repoRoot}\n`,
  );
  await runProcess(runtime, "pnpm", ["install", "--frozen-lockfile"], {
    cwd: repoRoot,
    env: runtime.env,
  });
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
  _runtime: CliRuntime,
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
      stdio: [
        "ignore",
        stdoutMode === "inherit" ? "inherit" : "pipe",
        "inherit",
      ],
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
        reject(
          new CliError(
            `Command failed: ${command} ${args.join(" ")}`,
            code ?? 1,
          ),
        );
        return;
      }
      resolve({ stdout });
    });
  });
}

export async function ensureDatabaseSchema(runtime: CliRuntime) {
  const repoRoot = resolveRepoRoot(runtime.env);
  await ensureWorkspaceDependencies(runtime, repoRoot);
  await runProcess(runtime, "pnpm", ["db:push"], {
    cwd: repoRoot,
    env: runtime.env,
  });
}

export async function ensureWebBuild(
  runtime: CliRuntime,
  options: { force?: boolean } = {},
) {
  const repoRoot = resolveRepoRoot(runtime.env);
  const webDistDir = path.join(repoRoot, "apps/web/dist/index.html");
  if (!options.force && (await pathExists(webDistDir))) {
    return;
  }

  const webPackage = path.join(repoRoot, "apps/web/package.json");
  if (!(await pathExists(webPackage))) {
    return;
  }

  await ensureWorkspaceDependencies(runtime, repoRoot, { webBuild: true });
  await runProcess(runtime, "pnpm", ["--filter", "@paperai/web", "build"], {
    cwd: repoRoot,
    env: runtime.env,
  });
}

export async function resolveBackupPath(
  config: PaperAiConfig,
  fileName?: string,
): Promise<string> {
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
    throw new CliError(
      "`pg_dump` is required for `paperai db:backup` but was not found in PATH.",
    );
  }
}

export async function createDatabaseBackup(
  runtime: CliRuntime,
  connectionString: string,
  outputPath: string,
) {
  await runProcess(
    runtime,
    "pg_dump",
    ["--dbname", connectionString, "--file", outputPath],
    {
      env: runtime.env,
    },
  );
}

export async function ensurePaperAiHome(runtime: CliRuntime) {
  await ensureWritableDirectory(getPaperAiHomeDir(runtime.env));
}

export async function readDirectorySummary(
  targetPath: string,
): Promise<string> {
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
