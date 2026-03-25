import type { FastifyPluginAsync } from "fastify";
import {
  checkoutIssueSchema,
  checkoutTaskSchema,
  bootstrapCeoSchema,
  createAgentSchema,
  createAgentAccessTokenSchema,
  createAgentApiKeySchema,
  createApprovalSchema,
  createBoardClaimChallengeSchema,
  createCliAuthChallengeSchema,
  createCompanySchema,
  createGoalSchema,
  createIssueCommentSchema,
  createIssueSchema,
  createInviteSchema,
  createPluginSchema,
  createProjectSchema,
  createRoutineSchema,
  createTaskCommentSchema,
  createTaskSchema,
  importCompanyPackageSchema,
  loginSchema,
  registerSchema,
  approveCliAuthChallengeSchema,
  resolveApprovalSchema,
  updateCompanySchema,
  updateGoalSchema,
  updateIssueSchema,
  updateProjectSchema,
  updateTaskSchema,
} from "@paperai/shared";

function parseCompanyId(input: unknown): string {
  if (typeof input !== "string" || input.length === 0) {
    throw new Error("companyId_required");
  }
  return input;
}

export const routes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({ ok: true }));

  app.post("/api/v1/setup/board-claim", async (request) => {
    const payload = createBoardClaimChallengeSchema.parse(request.body);
    return await app.platformService.createBoardClaimChallenge(app.paperaiConfig.auth.boardClaimTtlMinutes, payload.force);
  });

  app.post("/api/v1/setup/bootstrap-ceo", async (request) => {
    const payload = bootstrapCeoSchema.parse(request.body);
    return await app.platformService.bootstrapChiefExecutiveOfficer(payload);
  });

  app.post("/api/v1/auth/register", async (request) => {
    const payload = registerSchema.parse(request.body);
    const user = await app.platformService.registerUser(payload);
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return { user, token };
  });

  app.post("/api/v1/auth/login", async (request) => {
    const payload = loginSchema.parse(request.body);
    const user = await app.platformService.login(payload);
    const token = app.jwt.sign({ sub: user.id, email: user.email });
    return { user, token };
  });

  app.post("/api/v1/auth/cli/challenges", async (request) => {
    const payload = createCliAuthChallengeSchema.parse(request.body);
    return await app.platformService.createCliAuthChallenge(app.paperaiConfig.auth.cliChallengeTtlMinutes, payload.name);
  });

  app.get("/api/v1/auth/cli/challenges/:challengeId", async (request) => {
    const query = request.query as { challengeToken?: string };
    return await app.platformService.getCliAuthChallengeStatus(
      (request.params as { challengeId: string }).challengeId,
      query.challengeToken,
    );
  });

  app.post("/api/v1/auth/cli/challenges/:challengeId/approve", { preHandler: app.authenticate }, async (request) => {
    const payload = approveCliAuthChallengeSchema.parse(request.body);
    return await app.platformService.approveCliAuthChallenge(
      request.user.sub,
      (request.params as { challengeId: string }).challengeId,
      payload.challengeToken,
    );
  });

  app.get("/api/v1/me", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.getUser(request.user.sub);
  });

  app.get("/api/v1/companies", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listCompaniesForUser(request.user.sub);
  });

  app.post("/api/v1/companies", { preHandler: app.authenticate }, async (request) => {
    const payload = createCompanySchema.parse(request.body);
    return await app.platformService.createCompany(request.user.sub, payload);
  });

  app.patch("/api/v1/companies/:companyId", { preHandler: app.authenticate }, async (request) => {
    const payload = updateCompanySchema.parse(request.body);
    return await app.platformService.updateCompany(request.user.sub, (request.params as { companyId: string }).companyId, payload);
  });

  app.get("/api/v1/memberships", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listMemberships(request.user.sub, companyId);
  });

  app.get("/api/v1/companies/:companyId/members", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listCompanyMembers(
      request.user.sub,
      (request.params as { companyId: string }).companyId,
    );
  });

  app.get("/api/v1/companies/:companyId/invites", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listInvites(request.user.sub, (request.params as { companyId: string }).companyId);
  });

  app.post("/api/v1/companies/:companyId/invites", { preHandler: app.authenticate }, async (request) => {
    const payload = createInviteSchema.parse(request.body);
    return await app.platformService.createInvite(request.user.sub, (request.params as { companyId: string }).companyId, payload);
  });

  app.get("/api/v1/goals", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listGoals(request.user.sub, companyId);
  });

  app.post("/api/v1/goals", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { companyId?: string };
    const payload = createGoalSchema.parse(request.body);
    return await app.platformService.createGoal(request.user.sub, parseCompanyId(query.companyId), payload);
  });

  app.patch("/api/v1/goals/:goalId", { preHandler: app.authenticate }, async (request) => {
    const payload = updateGoalSchema.parse(request.body);
    return await app.platformService.updateGoal(request.user.sub, (request.params as { goalId: string }).goalId, payload);
  });

  app.get("/api/v1/projects", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listProjects(request.user.sub, companyId);
  });

  app.post("/api/v1/projects", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { companyId?: string };
    const payload = createProjectSchema.parse(request.body);
    return await app.platformService.createProject(request.user.sub, parseCompanyId(query.companyId), payload);
  });

  app.patch("/api/v1/projects/:projectId", { preHandler: app.authenticate }, async (request) => {
    const payload = updateProjectSchema.parse(request.body);
    return await app.platformService.updateProject(
      request.user.sub,
      (request.params as { projectId: string }).projectId,
      payload,
    );
  });

  app.get("/api/v1/issues", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listIssues(request.user.sub, companyId);
  });

  app.get("/api/v1/issues/:issueId", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.getIssueForActor(request.user.sub, (request.params as { issueId: string }).issueId);
  });

  app.post("/api/v1/issues", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = createIssueSchema.parse(request.body);
    return await app.platformService.createIssue(request.user.sub, companyId, payload);
  });

  app.patch("/api/v1/issues/:issueId", { preHandler: app.authenticate }, async (request) => {
    const payload = updateIssueSchema.parse(request.body);
    return await app.platformService.updateIssue(
      request.user.sub,
      (request.params as { issueId: string }).issueId,
      payload,
    );
  });

  app.post("/api/v1/issues/:issueId/checkout", { preHandler: app.authenticate }, async (request) => {
    const payload = checkoutIssueSchema.parse(request.body);
    return await app.platformService.checkoutIssue(
      request.user.sub,
      (request.params as { issueId: string }).issueId,
      payload.agentId,
      payload.heartbeatRunId,
    );
  });

  app.get("/api/v1/issues/:issueId/comments", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listIssueComments(request.user.sub, (request.params as { issueId: string }).issueId);
  });

  app.post("/api/v1/issues/:issueId/comments", { preHandler: app.authenticate }, async (request) => {
    const payload = createIssueCommentSchema.parse(request.body);
    return await app.platformService.addIssueComment(
      request.user.sub,
      (request.params as { issueId: string }).issueId,
      payload.body,
    );
  });

  app.get("/api/v1/agents", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listAgents(request.user.sub, companyId);
  });

  app.get("/api/v1/agents/:agentId", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.getAgentForActor(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.get("/api/v1/agents/:agentId/runtime", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.getAgentRuntimeState(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.get("/api/v1/agents/:agentId/sessions", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listAgentSessions(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.post("/api/v1/agents", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { companyId?: string };
    const payload = createAgentSchema.parse(request.body);
    return await app.platformService.createAgent(request.user.sub, parseCompanyId(query.companyId), payload);
  });

  app.post("/api/v1/agents/:agentId/pause", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.pauseAgent(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.post("/api/v1/agents/:agentId/resume", { preHandler: app.authenticate }, async (request) => {
    const agentId = (request.params as { agentId: string }).agentId;
    const resumed = await app.platformService.resumeAgent(request.user.sub, agentId);
    await app.runtime.requestWake(resumed.companyId, resumed.id, "manual", "resume");
    return resumed;
  });

  app.post("/api/v1/agents/:agentId/terminate", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.terminateAgent(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.post("/api/v1/agents/:agentId/wake", { preHandler: app.authenticate }, async (request) => {
    const params = request.params as { agentId: string };
    const agent = await app.platformService.getAgent(params.agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await app.platformService.requirePermission(request.user.sub, agent.companyId, "agent:wake");
    return await app.runtime.requestWake(agent.companyId, agent.id, "manual");
  });

  app.post("/api/v1/agents/:agentId/api-keys", { preHandler: app.authenticate }, async (request) => {
    const payload = createAgentApiKeySchema.parse(request.body);
    return await app.platformService.createAgentApiKey(
      request.user.sub,
      (request.params as { agentId: string }).agentId,
      payload.name,
    );
  });

  app.post("/api/v1/agents/:agentId/access-token", { preHandler: app.authenticate }, async (request) => {
    const payload = createAgentAccessTokenSchema.parse(request.body);
    const agent = await app.platformService.prepareAgentAccess(request.user.sub, (request.params as { agentId: string }).agentId);
    const expiresInMinutes = payload.expiresInMinutes ?? app.paperaiConfig.auth.agentTokenTtlMinutes;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60_000).toISOString();
    const token = app.jwt.sign(
      {
        sub: agent.id,
        type: "agent",
        agentId: agent.id,
      },
      { expiresIn: `${expiresInMinutes}m` },
    );
    return {
      agentId: agent.id,
      expiresAt,
      token,
    };
  });

  app.post("/api/v1/agents/:agentId/test", { preHandler: app.authenticate }, async (request) => {
    const params = request.params as { agentId: string };
    const agent = await app.platformService.getAgent(params.agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await app.platformService.requirePermission(request.user.sub, agent.companyId, "agent:wake");
    return await app.runtime.testAgent(params.agentId);
  });

  app.post("/api/v1/agents/:agentId/reset-session", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.resetAgentSession(request.user.sub, (request.params as { agentId: string }).agentId);
  });

  app.get("/api/v1/agents/me", { preHandler: app.authenticateAgent }, async (request) => {
    return request.agent;
  });

  app.get("/api/v1/tasks", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listTasks(request.user.sub, companyId);
  });

  app.get("/api/v1/tasks/:taskId", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.getTaskForActor(request.user.sub, (request.params as { taskId: string }).taskId);
  });

  app.post("/api/v1/tasks", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = createTaskSchema.parse(request.body);
    return await app.platformService.createTask(request.user.sub, companyId, payload);
  });

  app.patch("/api/v1/tasks/:taskId", { preHandler: app.authenticate }, async (request) => {
    const payload = updateTaskSchema.parse(request.body);
    return await app.platformService.updateTask(request.user.sub, (request.params as { taskId: string }).taskId, payload);
  });

  app.post("/api/v1/tasks/:taskId/checkout", { preHandler: app.authenticate }, async (request) => {
    const payload = checkoutTaskSchema.parse(request.body);
    return await app.platformService.checkoutTask(request.user.sub, (request.params as { taskId: string }).taskId, payload.agentId, payload.heartbeatRunId);
  });

  app.get("/api/v1/tasks/:taskId/comments", { preHandler: app.authenticate }, async (request) => {
    return await app.platformService.listTaskComments(request.user.sub, (request.params as { taskId: string }).taskId);
  });

  app.post("/api/v1/tasks/:taskId/comments", { preHandler: app.authenticate }, async (request) => {
    const payload = createTaskCommentSchema.parse(request.body);
    return await app.platformService.addTaskComment(request.user.sub, (request.params as { taskId: string }).taskId, payload.body);
  });

  app.get("/api/v1/heartbeats", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listHeartbeats(request.user.sub, companyId);
  });

  app.get("/api/v1/approvals", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listApprovals(request.user.sub, companyId);
  });

  app.post("/api/v1/approvals", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = createApprovalSchema.parse(request.body);
    return await app.platformService.createApproval(request.user.sub, companyId, payload);
  });

  app.post("/api/v1/approvals/:approvalId/resolve", { preHandler: app.authenticate }, async (request) => {
    const payload = resolveApprovalSchema.parse(request.body);
    return await app.platformService.resolveApproval(
      request.user.sub,
      (request.params as { approvalId: string }).approvalId,
      payload.status,
      payload.resolutionNotes,
    );
  });

  app.get("/api/v1/budgets", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listBudgets(request.user.sub, companyId);
  });

  app.post("/api/v1/budgets", { preHandler: app.authenticate }, async (request) => {
    const query = request.query as { companyId?: string };
    return await app.platformService.upsertBudgetPolicy(
      request.user.sub,
      parseCompanyId(query.companyId),
      request.body as { agentId?: string | null; monthlyLimitCents: number; hardStop: boolean },
    );
  });

  app.get("/api/v1/costs", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listCosts(request.user.sub, companyId);
  });

  app.get("/api/v1/activity", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listActivity(request.user.sub, companyId);
  });

  app.get("/api/v1/routines", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listRoutines(request.user.sub, companyId);
  });

  app.post("/api/v1/routines", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = createRoutineSchema.parse(request.body);
    return await app.platformService.createRoutine(request.user.sub, companyId, payload);
  });

  app.get("/api/v1/plugins", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.listPlugins(request.user.sub, companyId);
  });

  app.post("/api/v1/plugins", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = createPluginSchema.parse(request.body);
    return await app.platformService.createPlugin(request.user.sub, companyId, payload);
  });

  app.post("/api/v1/plugins/validate", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.validatePlugin(request.user.sub, companyId, request.body as Record<string, unknown>);
  });

  app.post("/api/v1/packages/import", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    const payload = importCompanyPackageSchema.parse(request.body);
    return await app.platformService.importCompanyPackage(request.user.sub, companyId, payload.root);
  });

  app.get("/api/v1/packages/export", { preHandler: app.authenticate }, async (request) => {
    const companyId = parseCompanyId((request.query as { companyId?: string }).companyId);
    return await app.platformService.exportCompanyAsPackage(request.user.sub, companyId);
  });

  app.get("/api/v1/events", { preHandler: app.authenticate }, async (request, reply) => {
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });

    const unsubscribe = app.eventBus.subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    request.raw.on("close", () => {
      unsubscribe();
      reply.raw.end();
    });
  });
};
