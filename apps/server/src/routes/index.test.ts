import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { PlatformService } from "../services/platform-service.js";
import type { RuntimeOrchestrator } from "../services/runtime.js";

function createRuntimeStub() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    requestWake: vi.fn(),
    testAgent: vi.fn(),
  } as unknown as RuntimeOrchestrator;
}

function createPlatformServiceStub() {
  return {
    getAgentForActor: vi.fn(),
    getTaskForActor: vi.fn(),
    getIssueForActor: vi.fn(),
  } as unknown as PlatformService;
}

describe("resource read routes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a single agent through GET /api/v1/agents/:agentId", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const getAgentForActor = vi.spyOn(platformService, "getAgentForActor").mockResolvedValue({
      id: "agent-1",
      companyId: "company-1",
      parentAgentId: null,
      slug: "ops",
      name: "Ops",
      title: "Operations",
      capabilities: null,
      status: "idle",
      adapterType: "codex",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: [],
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      sessionState: null,
      lastHeartbeatAt: null,
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
    });

    const app = await createApp({
      config: {
        port: 3001,
        databaseUrl: "postgres://unused",
        jwtSecret: "test-secret",
        webOrigin: "http://localhost:5173",
      },
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/agents/agent-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "agent-1", companyId: "company-1" });
    expect(getAgentForActor).toHaveBeenCalledWith("user-1", "agent-1");
    await app.close();
  });

  it("returns a not_found error for unknown tasks", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    vi.spyOn(platformService, "getTaskForActor").mockRejectedValue(new Error("not_found"));

    const app = await createApp({
      config: {
        port: 3001,
        databaseUrl: "postgres://unused",
        jwtSecret: "test-secret",
        webOrigin: "http://localhost:5173",
      },
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/tasks/task-missing",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ message: "not_found" });
    await app.close();
  });

  it("surfaces permission failures for issue reads", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    vi.spyOn(platformService, "getIssueForActor").mockRejectedValue(new Error("forbidden"));

    const app = await createApp({
      config: {
        port: 3001,
        databaseUrl: "postgres://unused",
        jwtSecret: "test-secret",
        webOrigin: "http://localhost:5173",
      },
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/issues/issue-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ message: "forbidden" });
    await app.close();
  });

  it("rejects unauthenticated reads before hitting the service", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();

    const app = await createApp({
      config: {
        port: 3001,
        databaseUrl: "postgres://unused",
        jwtSecret: "test-secret",
        webOrigin: "http://localhost:5173",
      },
      platformService,
      runtime,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/agents/agent-1",
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
    expect(vi.mocked(platformService.getAgentForActor)).not.toHaveBeenCalled();
    await app.close();
  });
});
