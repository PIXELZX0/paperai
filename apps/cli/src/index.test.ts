import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getProfilePath } from "./lib/config.js";
import { runCli } from "./index.js";

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

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function executeCli(input: {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  profile?: Record<string, string>;
  stdinText?: string;
  fetchImpl?: typeof fetch;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "papercli-test-"));
  tempDirs.push(root);

  const env: NodeJS.ProcessEnv = {
    HOME: root,
    XDG_CONFIG_HOME: path.join(root, "xdg"),
    ...input.env,
  };

  if (input.profile) {
    const profilePath = getProfilePath(env);
    await mkdir(path.dirname(profilePath), { recursive: true });
    await writeFile(profilePath, `${JSON.stringify(input.profile, null, 2)}\n`);
  }

  const stdout = new MemoryWritable();
  const stderr = new MemoryWritable();
  const stdin = Readable.from(input.stdinText ? [input.stdinText] : []);
  (stdin as Readable & { isTTY?: boolean }).isTTY = input.stdinText === undefined;

  const exitCode = await runCli(input.argv, {
    env,
    stdout,
    stderr,
    stdin: stdin as Readable & { isTTY?: boolean },
    fetchImpl: input.fetchImpl ?? (async () => jsonResponse({ ok: true })) as typeof fetch,
    invocationName: "papercli",
  });

  return {
    exitCode,
    stdout: stdout.toString(),
    stderr: stderr.toString(),
  };
}

describe("papercli", () => {
  it("prefers flag values over env and profile values", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://flag.example/api/v1/tasks?companyId=flag-company");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer flag-token",
      });
      return jsonResponse([]);
    });

    const result = await executeCli({
      argv: ["task", "list", "--api-url", "http://flag.example/api/v1", "--token", "flag-token", "--company", "flag-company"],
      env: {
        PAPERAI_API_URL: "http://env.example/api/v1",
        PAPERAI_TOKEN: "env-token",
        PAPERAI_COMPANY_ID: "env-company",
      },
      profile: {
        apiUrl: "http://profile.example/api/v1",
        token: "profile-token",
        defaultCompanyId: "profile-company",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("falls back to env values before the saved profile", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://env.example/api/v1/tasks?companyId=env-company");
      expect(init?.headers).toMatchObject({
        authorization: "Bearer env-token",
      });
      return jsonResponse([]);
    });

    const result = await executeCli({
      argv: ["task", "list"],
      env: {
        PAPERAI_API_URL: "http://env.example/api/v1",
        PAPERAI_TOKEN: "env-token",
        PAPERAI_COMPANY_ID: "env-company",
      },
      profile: {
        apiUrl: "http://profile.example/api/v1",
        token: "profile-token",
        defaultCompanyId: "profile-company",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("uses the default API URL when no override is configured", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("http://localhost:3001/api/v1/auth/login");
      return jsonResponse({
        token: "token-1",
        user: {
          id: "user-1",
          email: "user@example.com",
          name: "User",
          createdAt: "2026-03-25T00:00:00.000Z",
        },
      });
    });

    const result = await executeCli({
      argv: ["auth", "login", "--email", "user@example.com", "--password", "password123"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reads comment bodies from --body, --body-file, and stdin", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "papercli-body-"));
    tempDirs.push(root);
    const bodyFile = path.join(root, "body.txt");
    await writeFile(bodyFile, "from-file\n");

    const calls: string[] = [];
    const fetchImpl = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      calls.push(String(body.body));
      return jsonResponse({
        id: "comment-1",
        taskId: "task-1",
        companyId: "company-1",
        authorUserId: "user-1",
        authorAgentId: null,
        body: body.body,
        createdAt: "2026-03-25T00:00:00.000Z",
      });
    });

    const sharedEnv = {
      PAPERAI_TOKEN: "token",
    };

    await executeCli({
      argv: ["task", "comment", "task-1", "--body", "from-inline"],
      env: sharedEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await executeCli({
      argv: ["task", "comment", "task-1", "--body-file", bodyFile],
      env: sharedEnv,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await executeCli({
      argv: ["task", "comment", "task-1"],
      env: sharedEnv,
      stdinText: "from-stdin\n",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(calls).toEqual(["from-inline", "from-file", "from-stdin"]);
  });

  it("uses PAPERAI_TASK_ID for task current and task status shortcuts", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse({
          id: "task-123",
          companyId: "company-1",
          projectId: null,
          goalId: null,
          parentTaskId: null,
          assigneeAgentId: null,
          createdByUserId: null,
          title: "Current task",
          description: null,
          status: "todo",
          priority: "medium",
          checkoutHeartbeatRunId: null,
          originKind: "manual",
          originRef: null,
          metadata: {},
          createdAt: "2026-03-25T00:00:00.000Z",
          updatedAt: "2026-03-25T00:00:00.000Z",
        });
      }

      return jsonResponse({
        id: "task-123",
        companyId: "company-1",
        projectId: null,
        goalId: null,
        parentTaskId: null,
        assigneeAgentId: null,
        createdByUserId: null,
        title: "Current task",
        description: null,
        status: "done",
        priority: "medium",
        checkoutHeartbeatRunId: null,
        originKind: "manual",
        originRef: null,
        metadata: {},
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
      });
    });

    const env = {
      PAPERAI_TOKEN: "token",
      PAPERAI_TASK_ID: "task-123",
    };

    await executeCli({
      argv: ["task", "current"],
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await executeCli({
      argv: ["task", "complete"],
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(calls).toEqual([
      {
        url: "http://localhost:3001/api/v1/tasks/task-123",
        method: "GET",
        body: undefined,
      },
      {
        url: "http://localhost:3001/api/v1/tasks/task-123",
        method: "PATCH",
        body: { status: "done" },
      },
    ]);
  });

  it("routes issue and approval shortcuts through the expected APIs", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method ?? "GET",
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return jsonResponse({ ok: true });
    });

    const env = {
      PAPERAI_TOKEN: "token",
      PAPERAI_TASK_ID: "issue-123",
    };

    await executeCli({
      argv: ["issue", "block"],
      env,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await executeCli({
      argv: ["approval", "resolve", "approval-1", "--status", "approved", "--resolution-notes", "Looks good"],
      env: {
        PAPERAI_TOKEN: "token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(calls).toEqual([
      {
        url: "http://localhost:3001/api/v1/issues/issue-123",
        method: "PATCH",
        body: { status: "blocked" },
      },
      {
        url: "http://localhost:3001/api/v1/approvals/approval-1/resolve",
        method: "POST",
        body: {
          status: "approved",
          resolutionNotes: "Looks good",
        },
      },
    ]);
  });

  it("keeps the legacy aliases wired to the new command implementations", async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("http://localhost:3001/api/v1/tasks?companyId=company-1");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({
        title: "Write docs",
        description: "Document the system",
        assigneeAgentId: "agent-1",
        status: "todo",
        priority: "medium",
        originKind: "manual",
      });
      return jsonResponse({
        id: "task-1",
        companyId: "company-1",
        projectId: null,
        goalId: null,
        parentTaskId: null,
        assigneeAgentId: "agent-1",
        createdByUserId: null,
        title: "Write docs",
        description: "Document the system",
        status: "todo",
        priority: "medium",
        checkoutHeartbeatRunId: null,
        originKind: "manual",
        originRef: null,
        metadata: {},
        createdAt: "2026-03-25T00:00:00.000Z",
        updatedAt: "2026-03-25T00:00:00.000Z",
      });
    });

    const result = await executeCli({
      argv: ["task:create", "--company", "company-1", "--title", "Write docs", "--description", "Document the system", "--assignee", "agent-1"],
      env: {
        PAPERAI_TOKEN: "token",
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
