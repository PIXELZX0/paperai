import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRepoRoot } from "./ops.js";

const tempDirs: string[] = [];
let originalCwd = process.cwd();
let originalArgv1 = process.argv[1];

afterEach(async () => {
  process.chdir(originalCwd);
  process.argv[1] = originalArgv1;
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function createWorkspaceRoot(root: string) {
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n");
}

describe("resolveRepoRoot", () => {
  it("returns the workspace root found from cwd ancestry", async () => {
    const root = await createTempDir("paperai-root-");
    await createWorkspaceRoot(root);

    const nested = path.join(root, "apps", "cli");
    await mkdir(nested, { recursive: true });
    process.chdir(nested);

    const resolved = resolveRepoRoot({});
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

    expect(() =>
      resolveRepoRoot({
        PAPERAI_REPO_ROOT: home,
      }),
    ).toThrow(/PAPERAI_REPO_ROOT must point to a PaperAI workspace root/);
  });
});
