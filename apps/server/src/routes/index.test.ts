import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import type { PlatformService } from "../services/platform-service.js";
import type { RuntimeOrchestrator } from "../services/runtime.js";

const testConfig = {
  host: "127.0.0.1",
  port: 3001,
  databaseUrl: "postgres://unused",
  jwtSecret: "test-secret",
  webOrigin: "http://localhost:5173",
  auth: {
    boardClaimTtlMinutes: 30,
    cliChallengeTtlMinutes: 10,
    agentTokenTtlMinutes: 60,
  },
} as const;

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
    createBoardClaimChallenge: vi.fn(),
    getAgentForActor: vi.fn(),
    getAgentRuntimeState: vi.fn(),
    pauseAgent: vi.fn(),
    resumeAgent: vi.fn(),
    getTaskForActor: vi.fn(),
    getIssueForActor: vi.fn(),
    updateCompany: vi.fn(),
    listCompanyMembers: vi.fn(),
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
      config: testConfig,
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
      config: testConfig,
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
      config: testConfig,
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
      config: testConfig,
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

  it("updates a company through PATCH /api/v1/companies/:companyId", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const updateCompany = vi.spyOn(platformService, "updateCompany").mockResolvedValue({
      id: "company-1",
      slug: "paperai-labs",
      name: "PaperAI Labs",
      description: "Updated description",
      status: "active",
      brandColor: "#06b6d4",
      monthlyBudgetCents: 250000,
      spentMonthlyCents: 0,
      packageSource: null,
      createdAt: "2026-03-25T00:00:00.000Z",
      updatedAt: "2026-03-25T00:00:00.000Z",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/companies/company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "PaperAI Labs",
        description: "Updated description",
        monthlyBudgetCents: 250000,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "company-1", name: "PaperAI Labs" });
    expect(updateCompany).toHaveBeenCalledWith("user-1", "company-1", {
      name: "PaperAI Labs",
      description: "Updated description",
      monthlyBudgetCents: 250000,
    });
    await app.close();
  });

  it("lists company members through GET /api/v1/companies/:companyId/members", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const listCompanyMembers = vi.spyOn(platformService, "listCompanyMembers").mockResolvedValue([
      {
        id: "membership-1",
        companyId: "company-1",
        userId: "user-1",
        role: "owner",
        createdAt: "2026-03-25T00:00:00.000Z",
        user: {
          id: "user-1",
          email: "owner@example.com",
          name: "Owner",
        },
      },
    ]);

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/companies/company-1/members",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([
      {
        companyId: "company-1",
        role: "owner",
        user: { email: "owner@example.com" },
      },
    ]);
    expect(listCompanyMembers).toHaveBeenCalledWith("user-1", "company-1");
    await app.close();
  });

  it("creates a board claim challenge through POST /api/v1/setup/board-claim", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const createBoardClaimChallenge = vi.spyOn(platformService, "createBoardClaimChallenge").mockResolvedValue({
      id: "claim-1",
      token: "claim-token",
      code: "123456",
      claimedByUserId: null,
      expiresAt: "2026-03-25T00:30:00.000Z",
      createdAt: "2026-03-25T00:00:00.000Z",
      claimedAt: null,
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/setup/board-claim",
      payload: {
        force: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "claim-1", token: "claim-token" });
    expect(createBoardClaimChallenge).toHaveBeenCalledWith(30, true);
    await app.close();
  });

  it("resumes an agent and queues a wake through POST /api/v1/agents/:agentId/resume", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const resumeAgent = vi.spyOn(platformService, "resumeAgent").mockResolvedValue({
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
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/agents/agent-1/resume",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "agent-1", status: "idle" });
    expect(resumeAgent).toHaveBeenCalledWith("user-1", "agent-1");
    expect(runtime.requestWake).toHaveBeenCalledWith("company-1", "agent-1", "manual", "resume");
    await app.close();
  });
});
