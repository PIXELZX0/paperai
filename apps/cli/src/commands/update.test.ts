import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaperAiConfig } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { updateAction } from "./update.js";
import { defaultPaperAiConfig, readInstanceConfig, writeInstanceConfig } from "../lib/config.js";
import {
  applyDataDirOverride,
  ensureDatabaseSchema,
  ensureEmbeddedDatabase,
  ensurePaperAiHome,
  ensureWebBuild,
  resolveApiUrlFromConfig,
} from "../lib/ops.js";

vi.mock("../lib/config.js", () => ({
  defaultPaperAiConfig: vi.fn(),
  readInstanceConfig: vi.fn(),
  writeInstanceConfig: vi.fn(),
}));

vi.mock("../lib/ops.js", () => ({
  applyDataDirOverride: vi.fn(),
  ensureDatabaseSchema: vi.fn(),
  ensureEmbeddedDatabase: vi.fn(),
  ensurePaperAiHome: vi.fn(),
  ensureWebBuild: vi.fn(),
  resolveApiUrlFromConfig: vi.fn(),
}));

class MemoryWritable extends Writable {
  private readonly chunks: string[] = [];

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.chunks.push(chunk.toString());
    callback();
  }

  override toString() {
    return this.chunks.join("");
  }
}

function createContext() {
  const stdout = new MemoryWritable();
  const saveProfile = vi.fn(async () => "/tmp/profile.json");
  const loadProfile = vi.fn(async () => ({ token: "token-1" }));
  const stdin = Readable.from([]);
  (stdin as Readable & { isTTY?: boolean }).isTTY = true;

  const context = {
    runtime: {
      fetchImpl: fetch,
      env: {},
      stdin: stdin as Readable & { isTTY?: boolean },
      stdout,
      stderr: new MemoryWritable(),
      invocationName: "paperai",
    },
    loadProfile,
    saveProfile,
  } as unknown as CommandContext;

  return { context, stdout, saveProfile };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("updateAction", () => {
  it("merges config defaults and refreshes the local install", async () => {
    const defaults: PaperAiConfig = {
      version: 1,
      database: {
        mode: "embedded-postgres" as const,
        embeddedDataDir: "/Users/test/.paperai/data/postgres",
        embeddedPort: 54329,
        backup: {
          dir: "/Users/test/.paperai/backups",
        },
      },
      server: {
        host: "127.0.0.1",
        port: 3001,
        webOrigin: "http://localhost:5173",
        jwtSecret: "default-secret",
      },
      auth: {
        boardClaimTtlMinutes: 30,
        cliChallengeTtlMinutes: 10,
        agentTokenTtlMinutes: 60,
      },
    };

    const current: PaperAiConfig = {
      version: 1,
      database: {
        mode: "embedded-postgres" as const,
        embeddedDataDir: "/srv/paperai/postgres",
        embeddedPort: 55432,
        backup: {
          dir: "/srv/paperai/backups",
        },
      },
      server: {
        host: "0.0.0.0",
        port: 4100,
        webOrigin: "https://paperai.local",
        jwtSecret: "custom-secret",
      },
      auth: {
        boardClaimTtlMinutes: 45,
        cliChallengeTtlMinutes: 15,
        agentTokenTtlMinutes: 90,
      },
    };

    vi.mocked(defaultPaperAiConfig).mockReturnValue(defaults);
    vi.mocked(readInstanceConfig).mockResolvedValue(current);
    vi.mocked(writeInstanceConfig).mockResolvedValue("/srv/paperai/config.json");
    vi.mocked(resolveApiUrlFromConfig).mockReturnValue("http://127.0.0.1:4100/api/v1");

    const stop = vi.fn(async () => {});
    vi.mocked(ensureEmbeddedDatabase).mockResolvedValue({
      started: true,
      stop,
      connectionString: "postgres://paperai",
    } as unknown as Awaited<ReturnType<typeof ensureEmbeddedDatabase>>);

    const { context, stdout, saveProfile } = createContext();
    await updateAction(context, {});

    expect(applyDataDirOverride).toHaveBeenCalledWith(context.runtime, {});
    expect(ensurePaperAiHome).toHaveBeenCalledWith(context.runtime);
    expect(writeInstanceConfig).toHaveBeenCalledWith(
      context.runtime.env,
      expect.objectContaining({
        version: 1,
        database: expect.objectContaining({
          mode: "embedded-postgres",
          embeddedDataDir: "/srv/paperai/postgres",
          embeddedPort: 55432,
          backup: {
            dir: "/srv/paperai/backups",
          },
        }),
        server: expect.objectContaining({
          host: "0.0.0.0",
          port: 4100,
          webOrigin: "https://paperai.local",
          jwtSecret: "custom-secret",
        }),
        auth: expect.objectContaining({
          boardClaimTtlMinutes: 45,
          cliChallengeTtlMinutes: 15,
          agentTokenTtlMinutes: 90,
        }),
      }),
    );
    expect(saveProfile).toHaveBeenCalledWith({
      token: "token-1",
      apiUrl: "http://127.0.0.1:4100/api/v1",
    });
    expect(ensureDatabaseSchema).toHaveBeenCalledWith(context.runtime);
    expect(ensureWebBuild).toHaveBeenCalledWith(context.runtime, { force: true });
    expect(stop).toHaveBeenCalledOnce();
    expect(JSON.parse(stdout.toString())).toEqual({
      ok: true,
      configPath: "/srv/paperai/config.json",
      apiUrl: "http://127.0.0.1:4100/api/v1",
      configVersion: 1,
      databaseMode: "embedded-postgres",
      configCreated: false,
      refreshed: ["config", "database_schema", "web_build"],
    });
  });
});
