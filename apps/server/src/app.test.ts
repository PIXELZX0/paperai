import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { PlatformService } from "./services/platform-service.js";
import type { RuntimeOrchestrator } from "./services/runtime.js";

const testConfig = {
  host: "127.0.0.1",
  port: 3001,
  databaseUrl: "postgres://unused",
  jwtSecret: "test-secret",
  webOrigin: "http://localhost:3001",
  auth: {
    boardClaimTtlMinutes: 30,
    cliChallengeTtlMinutes: 10,
    agentTokenTtlMinutes: 60,
  },
} as const;

const originalWebDistDir = process.env.PAPERAI_WEB_DIST_DIR;
const originalRepoRoot = process.env.PAPERAI_REPO_ROOT;
const tempDirs: string[] = [];

function createRuntimeStub() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as RuntimeOrchestrator;
}

describe("web static serving", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    process.env.PAPERAI_WEB_DIST_DIR = originalWebDistDir;
    process.env.PAPERAI_REPO_ROOT = originalRepoRoot;

    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  it("serves the web UI at the root route without requiring an Accept header", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "paperai-web-dist-"));
    tempDirs.push(tempDir);
    await writeFile(
      join(tempDir, "index.html"),
      '<!doctype html><title>PaperAI</title><div id="root"></div>',
    );
    process.env.PAPERAI_WEB_DIST_DIR = tempDir;
    delete process.env.PAPERAI_REPO_ROOT;

    const app = await createApp({
      config: testConfig,
      platformService: {} as PlatformService,
      runtime: createRuntimeStub(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain('<div id="root"></div>');
    await app.close();
  });
});
