import type {
  Agent,
  AgentOrgProfile,
  AgentAccessTokenCreated,
  AgentApiKeyCreated,
  AgentRuntimeState,
  AgentSession,
  ApprovalRequest,
  AuthUser,
  BoardClaimChallenge,
  BootstrapCeoResult,
  CliAuthChallengeStatus,
  Company,
  CompanyCostOverview,
  CompanySkill,
  Department,
  ExecutionWorkspace,
  FinanceEvent,
  Issue,
  IssueAttachment,
  IssueComment,
  IssueDocument,
  IssueDocumentRevision,
  IssueDocumentSummary,
  IssueWorkProduct,
  JoinRequest,
  JoinRequestResolution,
  Plugin,
  PluginHealth,
  PluginRuntimeActionResult,
  ProjectWorkspace,
  QuotaWindow,
  Secret,
  Position,
  Task,
  TaskComment,
} from "@paperai/shared";
import { CliError } from "./errors.js";

function joinUrl(base: string, pathname: string) {
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${normalizedBase}${normalizedPath}`;
}

export class PaperAiApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly fetchImpl: typeof fetch,
    private readonly token: string | null,
  ) {}

  private async request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const response = await this.fetchImpl(joinUrl(this.apiUrl, pathname), {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new CliError(
        `Request failed with status ${response.status}.`,
        response.status === 401 ? 2 : 1,
        text || undefined,
      );
    }

    return (await response.json()) as T;
  }

  me() {
    return this.request<AuthUser>("/me");
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  createBoardClaimChallenge(force = false) {
    return this.request<BoardClaimChallenge>("/setup/board-claim", {
      method: "POST",
      body: JSON.stringify({ force }),
    });
  }

  bootstrapChiefExecutiveOfficer(payload: Record<string, unknown>) {
    return this.request<BootstrapCeoResult>("/setup/bootstrap-ceo", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  createCliAuthChallenge(name?: string) {
    return this.request<CliAuthChallengeStatus>("/auth/cli/challenges", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  getCliAuthChallengeStatus(challengeId: string, challengeToken?: string) {
    const query = challengeToken ? `?challengeToken=${encodeURIComponent(challengeToken)}` : "";
    return this.request<CliAuthChallengeStatus>(`/auth/cli/challenges/${encodeURIComponent(challengeId)}${query}`);
  }

  approveCliAuthChallenge(challengeId: string, challengeToken: string) {
    return this.request<CliAuthChallengeStatus>(`/auth/cli/challenges/${encodeURIComponent(challengeId)}/approve`, {
      method: "POST",
      body: JSON.stringify({ challengeToken }),
    });
  }

  listCompanies() {
    return this.request<Company[]>("/companies");
  }

  listDepartments(companyId: string) {
    return this.request<Department[]>(`/departments?companyId=${encodeURIComponent(companyId)}`);
  }

  createDepartment(companyId: string, payload: Record<string, unknown>) {
    return this.request<Department>(`/departments?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateDepartment(departmentId: string, payload: Record<string, unknown>) {
    return this.request<Department>(`/departments/${encodeURIComponent(departmentId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  deleteDepartment(departmentId: string) {
    return this.request<Department>(`/departments/${encodeURIComponent(departmentId)}`, {
      method: "DELETE",
    });
  }

  listPositions(companyId: string) {
    return this.request<Position[]>(`/positions?companyId=${encodeURIComponent(companyId)}`);
  }

  createPosition(companyId: string, payload: Record<string, unknown>) {
    return this.request<Position>(`/positions?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updatePosition(positionId: string, payload: Record<string, unknown>) {
    return this.request<Position>(`/positions/${encodeURIComponent(positionId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  deletePosition(positionId: string) {
    return this.request<Position>(`/positions/${encodeURIComponent(positionId)}`, {
      method: "DELETE",
    });
  }

  listJoinRequests(companyId: string) {
    return this.request<JoinRequest[]>(`/companies/${encodeURIComponent(companyId)}/join-requests`);
  }

  createHumanJoinRequest(companyId: string, payload: Record<string, unknown>) {
    return this.request<JoinRequest>(`/companies/${encodeURIComponent(companyId)}/join-requests/human`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  createAgentJoinRequest(companyId: string, payload: Record<string, unknown>) {
    return this.request<JoinRequest>(`/companies/${encodeURIComponent(companyId)}/join-requests/agent`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  resolveJoinRequest(joinRequestId: string, payload: Record<string, unknown>) {
    return this.request<JoinRequestResolution>(`/join-requests/${encodeURIComponent(joinRequestId)}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  listAgents(companyId: string) {
    return this.request<Agent[]>(`/agents?companyId=${encodeURIComponent(companyId)}`);
  }

  updateAgentOrgProfile(agentId: string, payload: Record<string, unknown>) {
    return this.request<AgentOrgProfile>(`/agents/${encodeURIComponent(agentId)}/org-profile`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  getAgent(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}`);
  }

  getAgentRuntime(agentId: string) {
    return this.request<AgentRuntimeState>(`/agents/${encodeURIComponent(agentId)}/runtime`);
  }

  listAgentSessions(agentId: string) {
    return this.request<AgentSession[]>(`/agents/${encodeURIComponent(agentId)}/sessions`);
  }

  wakeAgent(agentId: string) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/wake`, { method: "POST" });
  }

  pauseAgent(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}/pause`, { method: "POST" });
  }

  resumeAgent(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}/resume`, { method: "POST" });
  }

  terminateAgent(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}/terminate`, { method: "POST" });
  }

  testAgent(agentId: string) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/test`, { method: "POST" });
  }

  resetAgentSession(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}/reset-session`, { method: "POST" });
  }

  createAgentApiKey(agentId: string, name: string) {
    return this.request<AgentApiKeyCreated>(`/agents/${encodeURIComponent(agentId)}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  createAgentAccessToken(agentId: string, expiresInMinutes?: number) {
    return this.request<AgentAccessTokenCreated>(`/agents/${encodeURIComponent(agentId)}/access-token`, {
      method: "POST",
      body: JSON.stringify(
        expiresInMinutes ? { expiresInMinutes } : {},
      ),
    });
  }

  listTasks(companyId: string) {
    return this.request<Task[]>(`/tasks?companyId=${encodeURIComponent(companyId)}`);
  }

  getTask(taskId: string) {
    return this.request<Task>(`/tasks/${encodeURIComponent(taskId)}`);
  }

  createTask(companyId: string, payload: Record<string, unknown>) {
    return this.request<Task>(`/tasks?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateTask(taskId: string, payload: Record<string, unknown>) {
    return this.request<Task>(`/tasks/${encodeURIComponent(taskId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  checkoutTask(taskId: string, agentId: string, heartbeatRunId?: string) {
    return this.request<Task>(`/tasks/${encodeURIComponent(taskId)}/checkout`, {
      method: "POST",
      body: JSON.stringify({
        agentId,
        heartbeatRunId,
      }),
    });
  }

  listTaskComments(taskId: string) {
    return this.request<TaskComment[]>(`/tasks/${encodeURIComponent(taskId)}/comments`);
  }

  addTaskComment(taskId: string, body: string) {
    return this.request<TaskComment>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  listIssues(companyId: string) {
    return this.request<Issue[]>(`/issues?companyId=${encodeURIComponent(companyId)}`);
  }

  getIssue(issueId: string) {
    return this.request<Issue>(`/issues/${encodeURIComponent(issueId)}`);
  }

  createIssue(companyId: string, payload: Record<string, unknown>) {
    return this.request<Issue>(`/issues?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateIssue(issueId: string, payload: Record<string, unknown>) {
    return this.request<Issue>(`/issues/${encodeURIComponent(issueId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  checkoutIssue(issueId: string, agentId: string, heartbeatRunId?: string) {
    return this.request<Issue>(`/issues/${encodeURIComponent(issueId)}/checkout`, {
      method: "POST",
      body: JSON.stringify({
        agentId,
        heartbeatRunId,
      }),
    });
  }

  listIssueComments(issueId: string) {
    return this.request<IssueComment[]>(`/issues/${encodeURIComponent(issueId)}/comments`);
  }

  addIssueComment(issueId: string, body: string) {
    return this.request<IssueComment>(`/issues/${encodeURIComponent(issueId)}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  listIssueDocuments(issueId: string) {
    return this.request<IssueDocumentSummary[]>(`/issues/${encodeURIComponent(issueId)}/documents`);
  }

  createIssueDocument(
    issueId: string,
    payload: { key: string; title: string; format: "markdown" | "text"; body: string },
  ) {
    return this.request<IssueDocument>(`/issues/${encodeURIComponent(issueId)}/documents`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateIssueDocument(
    documentId: string,
    payload: { title?: string; format?: "markdown" | "text"; body?: string },
  ) {
    return this.request<IssueDocument>(`/issue-documents/${encodeURIComponent(documentId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  listIssueDocumentRevisions(documentId: string) {
    return this.request<IssueDocumentRevision[]>(`/issue-documents/${encodeURIComponent(documentId)}/revisions`);
  }

  listIssueAttachments(issueId: string) {
    return this.request<IssueAttachment[]>(`/issues/${encodeURIComponent(issueId)}/attachments`);
  }

  createIssueAttachment(
    issueId: string,
    payload: {
      name: string;
      contentType: string;
      sizeBytes: number;
      url?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) {
    return this.request<IssueAttachment>(`/issues/${encodeURIComponent(issueId)}/attachments`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        metadata: payload.metadata ?? {},
      }),
    });
  }

  listIssueWorkProducts(issueId: string) {
    return this.request<IssueWorkProduct[]>(`/issues/${encodeURIComponent(issueId)}/work-products`);
  }

  createIssueWorkProduct(issueId: string, payload: { kind: string; title: string; content?: Record<string, unknown> }) {
    return this.request<IssueWorkProduct>(`/issues/${encodeURIComponent(issueId)}/work-products`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        content: payload.content ?? {},
      }),
    });
  }

  listApprovals(companyId: string) {
    return this.request<ApprovalRequest[]>(`/approvals?companyId=${encodeURIComponent(companyId)}`);
  }

  createApproval(companyId: string, payload: Record<string, unknown>) {
    return this.request<ApprovalRequest>(`/approvals?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  resolveApproval(approvalId: string, status: "approved" | "rejected", resolutionNotes?: string) {
    return this.request<ApprovalRequest>(`/approvals/${encodeURIComponent(approvalId)}/resolve`, {
      method: "POST",
      body: JSON.stringify({
        status,
        resolutionNotes,
      }),
    });
  }

  importPackage(companyId: string, root: string) {
    return this.request(`/packages/import?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify({ root }),
    });
  }

  exportPackage(companyId: string) {
    return this.request<Record<string, string>>(`/packages/export?companyId=${encodeURIComponent(companyId)}`);
  }

  getOrgTree(companyId: string) {
    return this.request(`/org-tree?companyId=${encodeURIComponent(companyId)}`);
  }

  async getOrgChartSvg(companyId: string) {
    const response = await this.fetchImpl(joinUrl(this.apiUrl, `/org-chart.svg?companyId=${encodeURIComponent(companyId)}`), {
      headers: {
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new CliError(
        `Request failed with status ${response.status}.`,
        response.status === 401 ? 2 : 1,
        text || undefined,
      );
    }

    return await response.text();
  }

  listProjectWorkspaces(companyId: string, projectId: string) {
    return this.request<ProjectWorkspace[]>(
      `/project-workspaces?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(projectId)}`,
    );
  }

  createProjectWorkspace(
    companyId: string,
    projectId: string,
    payload: {
      name: string;
      cwd?: string | null;
      repoUrl?: string | null;
      repoRef?: string | null;
      isPrimary: boolean;
    },
  ) {
    return this.request<ProjectWorkspace>(
      `/project-workspaces?companyId=${encodeURIComponent(companyId)}&projectId=${encodeURIComponent(projectId)}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  listExecutionWorkspaces(companyId: string, filters: { projectId?: string; issueId?: string } = {}) {
    const query = new URLSearchParams({ companyId });
    if (filters.projectId) {
      query.set("projectId", filters.projectId);
    }
    if (filters.issueId) {
      query.set("issueId", filters.issueId);
    }
    return this.request<ExecutionWorkspace[]>(`/execution-workspaces?${query.toString()}`);
  }

  createExecutionWorkspace(
    companyId: string,
    payload: {
      projectId?: string | null;
      issueId?: string | null;
      name: string;
      cwd?: string | null;
      repoUrl?: string | null;
      baseRef?: string | null;
      branchName?: string | null;
      mode: ExecutionWorkspace["mode"];
      status: ExecutionWorkspace["status"];
    },
  ) {
    return this.request<ExecutionWorkspace>(`/execution-workspaces?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  listSkills(companyId: string) {
    return this.request<CompanySkill[]>(`/skills?companyId=${encodeURIComponent(companyId)}`);
  }

  createSkill(
    companyId: string,
    payload: {
      slug: string;
      name: string;
      description?: string | null;
      markdown: string;
      sourceType: CompanySkill["sourceType"];
      sourceLocator?: string | null;
    },
  ) {
    return this.request<CompanySkill>(`/skills?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateSkill(
    skillId: string,
    payload: Partial<{
      slug: string;
      name: string;
      description: string | null;
      markdown: string;
      sourceType: CompanySkill["sourceType"];
      sourceLocator: string | null;
    }>,
  ) {
    return this.request<CompanySkill>(`/skills/${encodeURIComponent(skillId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  scanSkills(companyId: string, root: string, upsert = true) {
    return this.request<CompanySkill[]>(`/skills/scan?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify({ root, upsert }),
    });
  }

  listSecrets(companyId: string) {
    return this.request<Secret[]>(`/secrets?companyId=${encodeURIComponent(companyId)}`);
  }

  createSecret(companyId: string, payload: { name: string; value: string; valueHint?: string | null }) {
    return this.request<Secret>(`/secrets?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  updateSecret(secretId: string, payload: { value?: string; valueHint?: string | null }) {
    return this.request<Secret>(`/secrets/${encodeURIComponent(secretId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  getCostOverview(companyId: string) {
    return this.request<CompanyCostOverview>(`/costs/overview?companyId=${encodeURIComponent(companyId)}`);
  }

  listFinanceEvents(companyId: string) {
    return this.request<FinanceEvent[]>(`/costs/finance-events?companyId=${encodeURIComponent(companyId)}`);
  }

  listQuotaWindows(companyId: string) {
    return this.request<QuotaWindow[]>(`/costs/quota-windows?companyId=${encodeURIComponent(companyId)}`);
  }

  listPlugins(companyId: string) {
    return this.request<Plugin[]>(`/plugins?companyId=${encodeURIComponent(companyId)}`);
  }

  createPlugin(companyId: string, payload: { slug: string; name: string; manifest: Record<string, unknown>; config?: Record<string, unknown> }) {
    return this.request<Plugin>(`/plugins?companyId=${encodeURIComponent(companyId)}`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        config: payload.config ?? {},
      }),
    });
  }

  setPluginStatus(pluginId: string, status: "active" | "disabled") {
    return this.request<Plugin>(`/plugins/${encodeURIComponent(pluginId)}/status`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  }

  upgradePlugin(pluginId: string, payload: { manifest: Record<string, unknown>; config?: Record<string, unknown> }) {
    return this.request<Plugin>(`/plugins/${encodeURIComponent(pluginId)}/upgrade`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        config: payload.config ?? {},
      }),
    });
  }

  getPluginHealth(pluginId: string) {
    return this.request<PluginHealth>(`/plugins/${encodeURIComponent(pluginId)}/health`);
  }

  invokePluginTool(pluginId: string, toolName: string, input: Record<string, unknown> = {}) {
    return this.request<PluginRuntimeActionResult>(`/plugins/${encodeURIComponent(pluginId)}/tools/invoke`, {
      method: "POST",
      body: JSON.stringify({ toolName, input }),
    });
  }

  triggerPluginJob(pluginId: string, jobKey: string, input: Record<string, unknown> = {}) {
    return this.request<PluginRuntimeActionResult>(`/plugins/${encodeURIComponent(pluginId)}/jobs/trigger`, {
      method: "POST",
      body: JSON.stringify({ jobKey, input }),
    });
  }

  triggerPluginWebhook(pluginId: string, webhookKey: string, payload: Record<string, unknown> = {}) {
    return this.request<PluginRuntimeActionResult>(`/plugins/${encodeURIComponent(pluginId)}/webhooks/trigger`, {
      method: "POST",
      body: JSON.stringify({ webhookKey, payload }),
    });
  }
}
