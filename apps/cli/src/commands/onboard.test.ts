import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstanceConfigPath } from "../lib/config.js";
import type { CommandContext } from "../lib/context.js";
import { onboardAction } from "./onboard.js";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

const tempDirs: string[] = [];
let originalCwd = process.cwd();

afterEach(async () => {
  process.chdir(originalCwd);
  spawnMock.mockReset();
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

class NullWritable extends Writable {
  override _write(
    _chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    callback();
  }
}

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function createWorkspaceRoot(root: string) {
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "pnpm-workspace.yaml"),
    "packages:\n  - apps/*\n  - packages/*\n  - packages/adapters/*\n",
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

function createContext(env: NodeJS.ProcessEnv): CommandContext {
  const stdin = Readable.from([]) as Readable & { isTTY?: boolean };
  stdin.isTTY = false;

  return {
    runtime: {
      env,
      fetchImpl: fetch,
      stdin,
      stdout: new NullWritable(),
      stderr: new NullWritable(),
      invocationName: "papercli",
    },
    async loadProfile() {
      return {};
    },
    async saveProfile() {
      const profilePath = path.join(env.PAPERAI_HOME!, "profile.json");
      await mkdir(path.dirname(profilePath), { recursive: true });
      return profilePath;
    },
    async resolveApiUrl() {
      return "http://localhost:3001/api/v1";
    },
    async resolveToken() {
      return null;
    },
    async resolveCompanyId() {
      return null;
    },
    resolveAgentId() {
      return null;
    },
    resolveTaskId() {
      return null;
    },
    resolveIssueId() {
      return null;
    },
    async createApiClient() {
      throw new Error("not used in onboard tests");
    },
  };
}

describe("onboardAction", () => {
  it("bootstraps the managed repository root during non-interactive first run", async () => {
    const home = await createTempDir("paperai-onboard-managed-home-");
    const outside = await createTempDir("paperai-onboard-managed-outside-");
    process.chdir(outside);
    const env = {
      HOME: home,
      PAPERAI_HOME: path.join(home, ".paperai"),
    };
    const context = createContext(env);
    const managedRepoRoot = path.join(env.PAPERAI_HOME, "ws");

    spawnMock.mockImplementation((command: string, args: string[]) => {
      const child = new EventEmitter();
      queueMicrotask(async () => {
        try {
          if (command === "git" && args[0] === "clone") {
            await createWorkspaceRoot(String(args.at(-1)));
          }
          child.emit("close", 0);
        } catch (error) {
          child.emit("error", error);
        }
      });
      return child;
    });

    await onboardAction(context, {
      tui: false,
    });

    expect(spawnMock).toHaveBeenCalledWith(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "https://github.com/PIXELZX0/paperai.git",
        managedRepoRoot,
      ],
      expect.any(Object),
    );

    const persistedConfig = JSON.parse(
      await readFile(getInstanceConfigPath(env), "utf8"),
    ) as { repoRoot?: string };
    expect(persistedConfig.repoRoot).toBe(managedRepoRoot);
  });

  it("does not persist config when repository bootstrap fails", async () => {
    const home = await createTempDir("paperai-onboard-home-");
    const env = {
      HOME: home,
      PAPERAI_HOME: path.join(home, ".paperai"),
    };
    const context = createContext(env);
    const repoRoot = path.join(home, "checkout");

    spawnMock.mockImplementation(() => {
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("close", 1));
      return child;
    });

    await expect(
      onboardAction(context, {
        workspaceRoot: repoRoot,
        tui: false,
      }),
    ).rejects.toThrow(/Command failed: git clone --depth 1/);

    await expect(access(getInstanceConfigPath(env))).rejects.toBeDefined();
  });
});
