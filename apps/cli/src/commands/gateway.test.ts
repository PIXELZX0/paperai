import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import type { CommandContext } from "../lib/context.js";
import { getInstanceConfigPath } from "../lib/config.js";
import { gatewayInstallAction } from "./gateway.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.map((dir) => rm(dir, { recursive: true, force: true })),
  );
  tempDirs.length = 0;
});

class MemoryWritable extends Writable {
  private readonly chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ) {
    this.chunks.push(String(chunk));
    callback();
  }

  override toString() {
    return this.chunks.join("");
  }
}

async function createTempDir(prefix: string) {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createContext(env: NodeJS.ProcessEnv): {
  context: CommandContext;
  stdout: MemoryWritable;
} {
  const stdout = new MemoryWritable();
  const stdin = Readable.from([]) as Readable & { isTTY?: boolean };
  stdin.isTTY = false;

  return {
    stdout,
    context: {
      runtime: {
        env,
        fetchImpl: fetch,
        stdin,
        stdout,
        stderr: new MemoryWritable(),
        invocationName: "papercli",
      },
      async loadProfile() {
        return {};
      },
      async saveProfile() {
        return path.join(env.PAPERAI_HOME!, "profile.json");
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
        throw new Error("not used in gateway tests");
      },
    },
  };
}

describe("gatewayInstallAction", () => {
  it("prints a systemd user unit without writing files during dry-run", async () => {
    const home = await createTempDir("paperai-gateway-home-");
    const env = {
      HOME: home,
      PAPERAI_HOME: path.join(home, ".paperai"),
      PATH: "/usr/local/bin:/usr/bin",
    };
    const { context, stdout } = createContext(env);

    await gatewayInstallAction(context, {
      dryRun: true,
    });

    const output = JSON.parse(stdout.toString()) as {
      installed: boolean;
      scope: string;
      systemctlCommands: string[][];
      unitContent: string;
      unitPath: string;
    };
    expect(output.installed).toBe(false);
    expect(output.scope).toBe("user");
    expect(output.unitPath).toBe(
      path.join(home, ".config/systemd/user/paperai-gateway.service"),
    );
    expect(output.systemctlCommands).toContainEqual([
      "--user",
      "daemon-reload",
    ]);
    expect(output.systemctlCommands).toContainEqual([
      "--user",
      "enable",
      "paperai-gateway.service",
    ]);
    expect(output.unitContent).toContain("Description=PaperAI Gateway");
    expect(output.unitContent).toContain(
      `Environment="PAPERAI_CONFIG=${getInstanceConfigPath(env)}"`,
    );
    expect(output.unitContent).toContain(
      `"papercli" "run" "--config" "${getInstanceConfigPath(env)}"`,
    );
    await expect(access(output.unitPath)).rejects.toBeDefined();
  });

  it("writes the unit file without running systemctl for an overridden unit directory", async () => {
    const home = await createTempDir("paperai-gateway-install-home-");
    const unitDir = path.join(home, "units");
    const workingDirectory = path.join(home, "repo");
    await mkdir(workingDirectory, { recursive: true });
    const env = {
      HOME: home,
      PAPERAI_HOME: path.join(home, ".paperai"),
      PATH: "/usr/local/bin:/usr/bin",
    };
    const { context, stdout } = createContext(env);

    await gatewayInstallAction(context, {
      binary: "/usr/local/bin/papercli",
      enable: false,
      unitDir,
      workingDirectory,
    });

    const output = JSON.parse(stdout.toString()) as {
      installed: boolean;
      systemctlCommands: string[][];
      unitPath: string;
    };
    expect(output.installed).toBe(true);
    expect(output.systemctlCommands).toEqual([]);

    const unitContent = await readFile(output.unitPath, "utf8");
    expect(unitContent).toContain(`WorkingDirectory="${workingDirectory}"`);
    expect(unitContent).toContain(
      `ExecStart="/usr/local/bin/papercli" "run" "--config" "${getInstanceConfigPath(env)}"`,
    );
  });
});
