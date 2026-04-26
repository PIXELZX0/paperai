import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  ensureDatabaseSchema,
  ensurePaperAiCheckout,
  ensureWebBuild,
  resolveRepoRoot,
  validateRepoRootCandidatePath,
} from "./ops.js";

const tempDirs: string[] = [];
let originalCwd = process.cwd();
let originalArgv1 = process.argv[1];

const DEFAULT_PNPM_WORKSPACE_YAML = [
  "packages:",
  "  - apps/*",
  "  - packages/*",
  "  - packages/adapters/*",
  "",
].join("\n");

afterEach(async () => {
  process.chdir(originalCwd);
  process.argv[1] = originalArgv1;
  spawnMock.mockReset();
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function createWorkspaceRoot(root: string) {
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "pnpm-workspace.yaml"),
    DEFAULT_PNPM_WORKSPACE_YAML,
  );
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "paperai", private: true }, null, 2)}\n`,
  );
  await mkdir(path.join(root, "apps", "server"), { recursive: true });
  await writeFile(
    path.join(root, "apps", "server", "package.json"),
    `${JSON.stringify({ name: "@paperai/server" }, null, 2)}\n`,
  );
}

function binName(name: string) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

async function createRootDependencySentinels(root: string) {
  await mkdir(path.join(root, "node_modules", ".bin"), { recursive: true });
  await writeFile(path.join(root, "node_modules", ".modules.yaml"), "ok\n");
  await writeFile(
    path.join(root, "node_modules", ".bin", binName("drizzle-kit")),
    "",
  );
}

async function createWebPackage(root: string) {
  await mkdir(path.join(root, "apps", "web"), { recursive: true });
  await writeFile(
    path.join(root, "apps", "web", "package.json"),
    `${JSON.stringify({ name: "@paperai/web" }, null, 2)}\n`,
  );
}

async function createWebDependencySentinels(root: string) {
  await mkdir(path.join(root, "apps", "web", "node_modules", ".bin"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "apps", "web", "node_modules", ".bin", binName("vite")),
    "",
  );
}

function installCloneMock() {
  spawnMock.mockImplementation((command: string, args: string[]) => {
    const child = new EventEmitter() as EventEmitter & {
      stdout?: EventEmitter;
    };

    void (async () => {
      if (command === "git" && args[0] === "clone") {
        const target = args.at(-1);
        if (!target) {
          throw new Error("missing clone target");
        }
        await createWorkspaceRoot(String(target));
      }
      child.emit("close", 0);
    })().catch((error) => {
      child.emit("error", error);
    });

    return child;
  });
}

function installSuccessfulProcessMock() {
  spawnMock.mockImplementation(() => {
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0));
    return child;
  });
}

describe("resolveRepoRoot", () => {
  it("returns the workspace root found from cwd ancestry", async () => {
    const root = await createTempDir("paperai-root-");
    await createWorkspaceRoot(root);

    const nested = path.join(root, "apps", "cli");
    await mkdir(nested, { recursive: true });
    process.chdir(nested);

    const resolved = resolveRepoRoot({
      HOME: root,
      PWD: nested,
    });
    expect(await realpath(resolved)).toBe(await realpath(root));
  });

  it("falls back to HOME/paperai when cwd is outside a workspace", async () => {
    const home = await createTempDir("paperai-home-");
    const repo = path.join(home, "paperai");
    await createWorkspaceRoot(repo);

    const outside = await createTempDir("paperai-outside-");
    process.chdir(outside);
    process.argv[1] = "/tmp/not-paperai-binary";

    const resolved = resolveRepoRoot({
      HOME: home,
      PWD: outside,
    });
    expect(resolved).toBe(repo);
  });

  it("throws when PAPERAI_REPO_ROOT is set to a non-workspace path", async () => {
    const home = await createTempDir("paperai-invalid-root-");
    await mkdir(home, { recursive: true });
    await writeFile(
      path.join(home, "pnpm-workspace.yaml"),
      DEFAULT_PNPM_WORKSPACE_YAML,
    );

    expect(() =>
      resolveRepoRoot({
        PAPERAI_REPO_ROOT: home,
      }),
    ).toThrow(
      /PAPERAI_REPO_ROOT must point to a PaperAI repository checkout root/,
    );
  });

  it("uses config.repoRoot when set and cwd is outside a workspace", async () => {
    const home = await createTempDir("paperai-config-home-");
    const repo = path.join(home, "custom-repo");
    await createWorkspaceRoot(repo);

    const configDir = path.join(home, ".paperai");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.json"),
      `${JSON.stringify({ repoRoot: repo }, null, 2)}\n`,
    );

    const outside = await createTempDir("paperai-config-outside-");
    process.chdir(outside);
    process.argv[1] = "/tmp/not-paperai-binary";

    const resolved = resolveRepoRoot({
      HOME: home,
      PWD: outside,
    });
    expect(resolved).toBe(repo);
  });

  it("throws when config.repoRoot is set to a non-workspace path", async () => {
    const home = await createTempDir("paperai-invalid-config-home-");
    const invalidRepo = path.join(home, "invalid-repo");
    await mkdir(invalidRepo, { recursive: true });
    await writeFile(
      path.join(invalidRepo, "pnpm-workspace.yaml"),
      DEFAULT_PNPM_WORKSPACE_YAML,
    );

    const configDir = path.join(home, ".paperai");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, "config.json"),
      `${JSON.stringify({ repoRoot: invalidRepo }, null, 2)}\n`,
    );

    const outside = await createTempDir("paperai-invalid-config-outside-");
    process.chdir(outside);
    process.argv[1] = "/tmp/not-paperai-binary";

    expect(() =>
      resolveRepoRoot({
        HOME: home,
        PWD: outside,
      }),
    ).toThrow(/config\.repoRoot/);
  });

  it("accepts an existing directory as a workspace root candidate", async () => {
    const root = await createTempDir("paperai-candidate-root-");

    expect(validateRepoRootCandidatePath(root, "workspace root")).toBe(root);
  });

  it("accepts a missing directory as a workspace root candidate", async () => {
    const base = await createTempDir("paperai-candidate-missing-");
    const root = path.join(base, "repo");

    expect(validateRepoRootCandidatePath(root, "workspace root")).toBe(root);
  });

  it("rejects a populated directory that is not a PaperAI checkout", async () => {
    const root = await createTempDir("paperai-candidate-invalid-");
    await writeFile(path.join(root, "README.txt"), "not a repo\n");

    expect(() => validateRepoRootCandidatePath(root, "workspace root")).toThrow(
      /must point to an existing PaperAI checkout, an empty directory/,
    );
  });
});

describe("ensurePaperAiCheckout", () => {
  it("does nothing when the target is already a valid PaperAI checkout", async () => {
    const root = await createTempDir("paperai-existing-repo-");
    await createWorkspaceRoot(root);

    const runtime = { env: {}, stderr: process.stderr, stdout: process.stdout };
    const resolved = await ensurePaperAiCheckout(runtime as never, root);

    expect(resolved).toBe(root);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("clones into a missing target directory by default", async () => {
    const base = await createTempDir("paperai-clone-base-");
    const root = path.join(base, "checkout");
    installCloneMock();

    const runtime = { env: {}, stderr: process.stderr, stdout: process.stdout };
    const resolved = await ensurePaperAiCheckout(runtime as never, root);

    expect(resolved).toBe(root);
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "https://github.com/PIXELZX0/paperai.git",
        root,
      ],
      expect.any(Object),
    );
    expect(resolveRepoRoot({ PAPERAI_REPO_ROOT: root })).toBe(root);
  });

  it("replaces a recoverable stub directory with a real checkout", async () => {
    const root = await createTempDir("paperai-stub-root-");
    await writeFile(
      path.join(root, "pnpm-workspace.yaml"),
      DEFAULT_PNPM_WORKSPACE_YAML,
    );
    installCloneMock();

    const runtime = { env: {}, stderr: process.stderr, stdout: process.stdout };
    await ensurePaperAiCheckout(runtime as never, root);

    expect(spawnMock).toHaveBeenCalledOnce();
    expect(resolveRepoRoot({ PAPERAI_REPO_ROOT: root })).toBe(root);
  });

  it("throws for a non-empty directory that is not recoverable", async () => {
    const root = await createTempDir("paperai-nonrecoverable-");
    await writeFile(path.join(root, "README.txt"), "not a repo\n");

    const runtime = { env: {}, stderr: process.stderr, stdout: process.stdout };

    await expect(ensurePaperAiCheckout(runtime as never, root)).rejects.toThrow(
      /cannot be recovered automatically/,
    );
    expect(spawnMock).not.toHaveBeenCalled();
  });
});

describe("workspace script prerequisites", () => {
  it("installs missing repository dependencies before pushing schema", async () => {
    const root = await createTempDir("paperai-schema-missing-deps-");
    await createWorkspaceRoot(root);
    installSuccessfulProcessMock();

    const runtime = {
      env: { PAPERAI_REPO_ROOT: root },
      stderr: process.stderr,
      stdout: process.stdout,
    };
    await ensureDatabaseSchema(runtime as never);

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["install", "--frozen-lockfile"],
      expect.objectContaining({ cwd: root }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["db:push"],
      expect.objectContaining({ cwd: root }),
    );
  });

  it("uses existing repository dependencies when pushing schema", async () => {
    const root = await createTempDir("paperai-schema-existing-deps-");
    await createWorkspaceRoot(root);
    await createRootDependencySentinels(root);
    installSuccessfulProcessMock();

    const runtime = {
      env: { PAPERAI_REPO_ROOT: root },
      stderr: process.stderr,
      stdout: process.stdout,
    };
    await ensureDatabaseSchema(runtime as never);

    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith(
      "pnpm",
      ["db:push"],
      expect.objectContaining({ cwd: root }),
    );
  });

  it("installs when web build dependencies are missing", async () => {
    const root = await createTempDir("paperai-web-missing-deps-");
    await createWorkspaceRoot(root);
    await createRootDependencySentinels(root);
    await createWebPackage(root);
    installSuccessfulProcessMock();

    const runtime = {
      env: { PAPERAI_REPO_ROOT: root },
      stderr: process.stderr,
      stdout: process.stdout,
    };
    await ensureWebBuild(runtime as never, { force: true });

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      "pnpm",
      ["install", "--frozen-lockfile"],
      expect.objectContaining({ cwd: root }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(
      2,
      "pnpm",
      ["--filter", "@paperai/web", "build"],
      expect.objectContaining({ cwd: root }),
    );
  });

  it("uses existing web build dependencies", async () => {
    const root = await createTempDir("paperai-web-existing-deps-");
    await createWorkspaceRoot(root);
    await createRootDependencySentinels(root);
    await createWebPackage(root);
    await createWebDependencySentinels(root);
    installSuccessfulProcessMock();

    const runtime = {
      env: { PAPERAI_REPO_ROOT: root },
      stderr: process.stderr,
      stdout: process.stdout,
    };
    await ensureWebBuild(runtime as never, { force: true });

    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith(
      "pnpm",
      ["--filter", "@paperai/web", "build"],
      expect.objectContaining({ cwd: root }),
    );
  });
});
