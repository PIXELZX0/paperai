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
    getOrgTree: vi.fn(),
    getOrgChartPng: vi.fn(),
    getCostOverview: vi.fn(),
    listFinanceEvents: vi.fn(),
    listQuotaWindows: vi.fn(),
    listJoinRequests: vi.fn(),
    createHumanJoinRequest: vi.fn(),
    createAgentJoinRequest: vi.fn(),
    resolveJoinRequest: vi.fn(),
    createProjectWorkspace: vi.fn(),
    setPluginStatus: vi.fn(),
    getPluginUiBridge: vi.fn(),
    pauseAgent: vi.fn(),
    resumeAgent: vi.fn(),
    getTaskForActor: vi.fn(),
    getIssueForActor: vi.fn(),
    updateCompany: vi.fn(),
    listCompanyMembers: vi.fn(),
    listDepartments: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    deleteDepartment: vi.fn(),
    listPositions: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    deletePosition: vi.fn(),
    updateAgentOrgProfile: vi.fn(),
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
      departmentId: null,
      positionId: null,
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

  it("lists departments through GET /api/v1/departments", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const listDepartments = vi.spyOn(platformService, "listDepartments").mockResolvedValue([
      {
        id: "department-1",
        companyId: "company-1",
        slug: "engineering",
        name: "Engineering",
        description: "Build the core platform.",
        headAgentId: "agent-1",
        workSpecRelativePath: "departments/engineering/TEAM.md",
        lastWorkSpecTaskId: "task-1",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
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
      url: "/api/v1/departments?companyId=company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([{ slug: "engineering", lastWorkSpecTaskId: "task-1" }]);
    expect(listDepartments).toHaveBeenCalledWith(expect.objectContaining({ sub: "user-1" }), "company-1");
    await app.close();
  });

  it("creates a position through POST /api/v1/positions", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const createPosition = vi.spyOn(platformService, "createPosition").mockResolvedValue({
      id: "position-1",
      companyId: "company-1",
      slug: "cto",
      name: "Chief Technology Officer",
      description: null,
      isExecutive: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/positions?companyId=company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        slug: "cto",
        name: "Chief Technology Officer",
        isExecutive: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ slug: "cto", isExecutive: true });
    expect(createPosition).toHaveBeenCalledWith(
      expect.objectContaining({ sub: "user-1" }),
      "company-1",
      expect.objectContaining({ slug: "cto", isExecutive: true }),
    );
    await app.close();
  });

  it("updates agent org profile through PATCH /api/v1/agents/:agentId/org-profile", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const updateAgentOrgProfile = vi.spyOn(platformService, "updateAgentOrgProfile").mockResolvedValue({
      agentId: "agent-1",
      companyId: "company-1",
      departmentId: "11111111-1111-1111-1111-111111111111",
      positionId: "22222222-2222-2222-2222-222222222222",
      title: "Head of Engineering",
      updatedAt: "2026-04-01T00:00:00.000Z",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "PATCH",
      url: "/api/v1/agents/agent-1/org-profile",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        departmentId: "11111111-1111-1111-1111-111111111111",
        positionId: "22222222-2222-2222-2222-222222222222",
        title: "Head of Engineering",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      agentId: "agent-1",
      departmentId: "11111111-1111-1111-1111-111111111111",
      positionId: "22222222-2222-2222-2222-222222222222",
      title: "Head of Engineering",
    });
    expect(updateAgentOrgProfile).toHaveBeenCalledWith(expect.objectContaining({ sub: "user-1" }), "agent-1", {
      departmentId: "11111111-1111-1111-1111-111111111111",
      positionId: "22222222-2222-2222-2222-222222222222",
      title: "Head of Engineering",
    });
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
      departmentId: null,
      positionId: null,
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

  it("returns the org tree through GET /api/v1/org-tree", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const getOrgTree = vi.spyOn(platformService, "getOrgTree").mockResolvedValue({
      company: { id: "company-1", name: "PaperAI", slug: "paperai" },
      agents: [
        {
          id: "agent-1",
          name: "CEO",
          title: "Chief Executive Officer",
          department: null,
          position: null,
          status: "idle",
          children: [],
        },
      ],
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/org-tree?companyId=company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ company: { slug: "paperai" } });
    expect(getOrgTree).toHaveBeenCalledWith("user-1", "company-1");
    await app.close();
  });

  it("returns a PNG org chart through GET /api/v1/org-chart.png", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const getOrgChartPng = vi
      .spyOn(platformService, "getOrgChartPng")
      .mockResolvedValue(Uint8Array.from([137, 80, 78, 71]));

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/org-chart.png?companyId=company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/png");
    expect(getOrgChartPng).toHaveBeenCalledWith("user-1", "company-1");
    await app.close();
  });

  it("returns the cost overview through GET /api/v1/costs/overview", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const getCostOverview = vi.spyOn(platformService, "getCostOverview").mockResolvedValue({
      summary: {
        monthSpendCents: 1200,
        companyBudgetCents: 5000,
        utilizationRatio: 0.24,
      },
      byAgent: [{ agentId: "agent-1", amountCents: 1200 }],
      byProject: [],
      byProvider: [{ provider: "openai", amountCents: 1200 }],
      byBiller: [{ biller: "platform", amountCents: 1200 }],
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/costs/overview?companyId=company-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ summary: { monthSpendCents: 1200 } });
    expect(getCostOverview).toHaveBeenCalledWith("user-1", "company-1");
    await app.close();
  });

  it("returns finance events through GET /api/v1/costs/finance-events", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const listFinanceEvents = vi.spyOn(platformService, "listFinanceEvents").mockResolvedValue([
      {
        id: "finance-1",
        companyId: "company-1",
        agentId: "agent-1",
        heartbeatRunId: "heartbeat-1",
        projectId: "project-1",
        amountCents: 1200,
        currency: "USD",
        biller: "platform",
        provider: "openai",
        model: "gpt-5.4",
        direction: "debit",
        category: "usage_cost",
        metadata: {},
        createdAt: "2026-03-28T00:00:00.000Z",
      },
    ]);

    const app = await createApp({ config: testConfig, platformService, runtime });
    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/costs/finance-events?companyId=company-1",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject([{ id: "finance-1", provider: "openai" }]);
    expect(listFinanceEvents).toHaveBeenCalledWith("user-1", "company-1");
    await app.close();
  });

  it("resolves join requests through POST /api/v1/join-requests/:joinRequestId/resolve", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const resolveJoinRequest = vi.spyOn(platformService, "resolveJoinRequest").mockResolvedValue({
      joinRequest: {
        id: "join-1",
        companyId: "company-1",
        kind: "human",
        status: "approved",
        requestedByUserId: "user-2",
        requestedByAgentId: null,
        email: "candidate@example.com",
        role: "viewer",
        note: null,
        onboardingTitle: null,
        onboardingBody: null,
        manifest: {},
        agentDraft: null,
        resolvedByUserId: "user-1",
        resolvedAt: "2026-03-28T00:00:00.000Z",
        resolutionNotes: null,
        createdAt: "2026-03-28T00:00:00.000Z",
        updatedAt: "2026-03-28T00:00:00.000Z",
      },
      membership: null,
      agent: null,
    });

    const app = await createApp({ config: testConfig, platformService, runtime });
    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/join-requests/join-1/resolve",
      headers: { authorization: `Bearer ${token}` },
      payload: { status: "approved", role: "viewer" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ joinRequest: { id: "join-1", status: "approved" } });
    expect(resolveJoinRequest).toHaveBeenCalledWith("user-1", "join-1", {
      status: "approved",
      role: "viewer",
    });
    await app.close();
  });

  it("creates a project workspace through POST /api/v1/project-workspaces", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const createProjectWorkspace = vi.spyOn(platformService, "createProjectWorkspace").mockResolvedValue({
      id: "workspace-1",
      companyId: "company-1",
      projectId: "project-1",
      name: "main",
      cwd: "/workspace/paperai",
      repoUrl: "https://github.com/paperai/paperai",
      repoRef: "main",
      isPrimary: true,
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:00.000Z",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/project-workspaces?companyId=company-1&projectId=project-1",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        name: "main",
        cwd: "/workspace/paperai",
        repoUrl: "https://github.com/paperai/paperai",
        repoRef: "main",
        isPrimary: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "workspace-1", projectId: "project-1" });
    expect(createProjectWorkspace).toHaveBeenCalledWith("user-1", "company-1", "project-1", {
      name: "main",
      cwd: "/workspace/paperai",
      repoUrl: "https://github.com/paperai/paperai",
      repoRef: "main",
      isPrimary: true,
    });
    await app.close();
  });

  it("updates plugin status through POST /api/v1/plugins/:pluginId/status", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const setPluginStatus = vi.spyOn(platformService, "setPluginStatus").mockResolvedValue({
      id: "plugin-1",
      companyId: "company-1",
      slug: "release-bot",
      name: "Release Bot",
      status: "disabled",
      manifest: {
        slug: "release-bot",
        name: "Release Bot",
        version: "1.0.0",
        capabilities: ["tool"],
      },
      config: {},
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:00.000Z",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/plugins/plugin-1/status",
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: {
        status: "disabled",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "plugin-1", status: "disabled" });
    expect(setPluginStatus).toHaveBeenCalledWith("user-1", "plugin-1", "disabled");
    await app.close();
  });

  it("returns plugin UI bridge metadata through GET /api/v1/plugins/:pluginId/ui", async () => {
    const runtime = createRuntimeStub();
    const platformService = createPlatformServiceStub();
    const getPluginUiBridge = vi.spyOn(platformService, "getPluginUiBridge").mockResolvedValue({
      pluginId: "plugin-1",
      slug: "release-bot",
      name: "Release Bot",
      status: "active",
      slots: [{ slot: "sidebar", title: "Release Bot" }],
      mountUrl: "http://127.0.0.1:4444/ui",
    });

    const app = await createApp({
      config: testConfig,
      platformService,
      runtime,
    });

    const token = app.jwt.sign({ sub: "user-1", email: "user@example.com" });
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/plugins/plugin-1/ui",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      pluginId: "plugin-1",
      mountUrl: "http://127.0.0.1:4444/ui",
      slots: [{ slot: "sidebar" }],
    });
    expect(getPluginUiBridge).toHaveBeenCalledWith("user-1", "plugin-1");
    await app.close();
  });
});
