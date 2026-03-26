import type {
  ActivityEvent,
  Agent,
  ApprovalRequest,
  Company,
  CompanyCostOverview,
  CompanyMember,
  CompanySkill,
  CostEvent,
  ExecutionWorkspace,
  Goal,
  HeartbeatRun,
  Issue,
  IssueAttachment,
  IssueComment,
  IssueDocument,
  IssueDocumentRevision,
  IssueDocumentSummary,
  IssueWorkProduct,
  Invite,
  Plugin,
  PluginHealth,
  PluginRuntimeActionResult,
  Project,
  ProjectWorkspace,
  Routine,
  Secret,
  Task,
} from "@paperai/shared";

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ??
  (import.meta.env.DEV ? "http://localhost:3001/api/v1" : `${window.location.origin}/api/v1`);

export interface SessionState {
  token: string | null;
  user: { id: string; email: string; name: string } | null;
  selectedCompanyId?: string | null;
}

export function loadSession(): SessionState {
  const raw = localStorage.getItem("paperai.session");
  if (!raw) {
    return { token: null, user: null };
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return { token: null, user: null };
  }
}

export function saveSession(session: SessionState) {
  localStorage.setItem("paperai.session", JSON.stringify(session));
}

export async function apiRequest<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "request_failed");
  }

  return (await response.json()) as T;
}

export const api = {
  me: (token: string) => apiRequest("/me", token),
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: SessionState["user"] }>("/auth/login", null, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string, inviteToken?: string) =>
    apiRequest<{ token: string; user: SessionState["user"] }>("/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ name, email, password, inviteToken: inviteToken || undefined }),
    }),
  companies: (token: string) => apiRequest<Company[]>("/companies", token),
  createCompany: (token: string, payload: Record<string, unknown>) =>
    apiRequest<Company>("/companies", token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompany: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Company>(`/companies/${companyId}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  companyMembers: (token: string, companyId: string) =>
    apiRequest<CompanyMember[]>(`/companies/${companyId}/members`, token),
  invites: (token: string, companyId: string) => apiRequest<Invite[]>(`/companies/${companyId}/invites`, token),
  createInvite: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Invite>(`/companies/${companyId}/invites`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  goals: (token: string, companyId: string) => apiRequest<Goal[]>(`/goals?companyId=${companyId}`, token),
  createGoal: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Goal>(`/goals?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  projects: (token: string, companyId: string) => apiRequest<Project[]>(`/projects?companyId=${companyId}`, token),
  createProject: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Project>(`/projects?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  issues: (token: string, companyId: string) => apiRequest<Issue[]>(`/issues?companyId=${companyId}`, token),
  createIssue: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Issue>(`/issues?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  issueComments: (token: string, issueId: string) => apiRequest<IssueComment[]>(`/issues/${issueId}/comments`, token),
  issueDocuments: (token: string, issueId: string) =>
    apiRequest<IssueDocumentSummary[]>(`/issues/${issueId}/documents`, token),
  createIssueDocument: (
    token: string,
    issueId: string,
    payload: { key: string; title: string; format: "markdown" | "text"; body: string },
  ) =>
    apiRequest<IssueDocument>(`/issues/${issueId}/documents`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateIssueDocument: (
    token: string,
    documentId: string,
    payload: { title?: string; format?: "markdown" | "text"; body?: string },
  ) =>
    apiRequest<IssueDocument>(`/issue-documents/${documentId}`, token, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  issueDocumentRevisions: (token: string, documentId: string) =>
    apiRequest<IssueDocumentRevision[]>(`/issue-documents/${documentId}/revisions`, token),
  issueAttachments: (token: string, issueId: string) =>
    apiRequest<IssueAttachment[]>(`/issues/${issueId}/attachments`, token),
  createIssueAttachment: (
    token: string,
    issueId: string,
    payload: {
      name: string;
      contentType: string;
      sizeBytes: number;
      url?: string | null;
      metadata?: Record<string, unknown>;
    },
  ) =>
    apiRequest<IssueAttachment>(`/issues/${issueId}/attachments`, token, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        metadata: payload.metadata ?? {},
      }),
    }),
  issueWorkProducts: (token: string, issueId: string) =>
    apiRequest<IssueWorkProduct[]>(`/issues/${issueId}/work-products`, token),
  createIssueWorkProduct: (
    token: string,
    issueId: string,
    payload: { kind: string; title: string; content?: Record<string, unknown> },
  ) =>
    apiRequest<IssueWorkProduct>(`/issues/${issueId}/work-products`, token, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        content: payload.content ?? {},
      }),
    }),
  addIssueComment: (token: string, issueId: string, body: string) =>
    apiRequest<IssueComment>(`/issues/${issueId}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  agents: (token: string, companyId: string) => apiRequest<Agent[]>(`/agents?companyId=${companyId}`, token),
  createAgent: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Agent>(`/agents?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  wakeAgent: (token: string, agentId: string) =>
    apiRequest(`/agents/${agentId}/wake`, token, { method: "POST" }),
  tasks: (token: string, companyId: string) => apiRequest<Task[]>(`/tasks?companyId=${companyId}`, token),
  createTask: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Task>(`/tasks?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  taskComments: (token: string, taskId: string) => apiRequest(`/tasks/${taskId}/comments`, token),
  addTaskComment: (token: string, taskId: string, body: string) =>
    apiRequest(`/tasks/${taskId}/comments`, token, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  approvals: (token: string, companyId: string) => apiRequest<ApprovalRequest[]>(`/approvals?companyId=${companyId}`, token),
  resolveApproval: (token: string, approvalId: string, status: "approved" | "rejected") =>
    apiRequest(`/approvals/${approvalId}/resolve`, token, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  heartbeats: (token: string, companyId: string) => apiRequest<HeartbeatRun[]>(`/heartbeats?companyId=${companyId}`, token),
  costs: (token: string, companyId: string) => apiRequest<CostEvent[]>(`/costs?companyId=${companyId}`, token),
  costOverview: (token: string, companyId: string) =>
    apiRequest<CompanyCostOverview>(`/costs/overview?companyId=${companyId}`, token),
  activity: (token: string, companyId: string) => apiRequest<ActivityEvent[]>(`/activity?companyId=${companyId}`, token),
  orgTree: (token: string, companyId: string) => apiRequest(`/org-tree?companyId=${companyId}`, token),
  plugins: (token: string, companyId: string) => apiRequest<Plugin[]>(`/plugins?companyId=${companyId}`, token),
  createPlugin: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Plugin>(`/plugins?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setPluginStatus: (token: string, pluginId: string, status: "active" | "disabled") =>
    apiRequest<Plugin>(`/plugins/${pluginId}/status`, token, {
      method: "POST",
      body: JSON.stringify({ status }),
    }),
  upgradePlugin: (token: string, pluginId: string, payload: Record<string, unknown>) =>
    apiRequest<Plugin>(`/plugins/${pluginId}/upgrade`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  pluginHealth: (token: string, pluginId: string) => apiRequest<PluginHealth>(`/plugins/${pluginId}/health`, token),
  invokePluginTool: (token: string, pluginId: string, toolName: string, input: Record<string, unknown>) =>
    apiRequest<PluginRuntimeActionResult>(`/plugins/${pluginId}/tools/invoke`, token, {
      method: "POST",
      body: JSON.stringify({ toolName, input }),
    }),
  triggerPluginJob: (token: string, pluginId: string, jobKey: string, input: Record<string, unknown>) =>
    apiRequest<PluginRuntimeActionResult>(`/plugins/${pluginId}/jobs/trigger`, token, {
      method: "POST",
      body: JSON.stringify({ jobKey, input }),
    }),
  triggerPluginWebhook: (token: string, pluginId: string, webhookKey: string, payload: Record<string, unknown>) =>
    apiRequest<PluginRuntimeActionResult>(`/plugins/${pluginId}/webhooks/trigger`, token, {
      method: "POST",
      body: JSON.stringify({ webhookKey, payload }),
    }),
  skills: (token: string, companyId: string) => apiRequest<CompanySkill[]>(`/skills?companyId=${companyId}`, token),
  createSkill: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<CompanySkill>(`/skills?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  scanSkills: (token: string, companyId: string, payload: { root: string; upsert?: boolean }) =>
    apiRequest<CompanySkill[]>(`/skills/scan?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  secrets: (token: string, companyId: string) => apiRequest<Secret[]>(`/secrets?companyId=${companyId}`, token),
  createSecret: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<Secret>(`/secrets?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  projectWorkspaces: (token: string, companyId: string, projectId: string) =>
    apiRequest<ProjectWorkspace[]>(`/project-workspaces?companyId=${companyId}&projectId=${projectId}`, token),
  createProjectWorkspace: (token: string, companyId: string, projectId: string, payload: Record<string, unknown>) =>
    apiRequest<ProjectWorkspace>(`/project-workspaces?companyId=${companyId}&projectId=${projectId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  executionWorkspaces: (token: string, companyId: string, filters?: { projectId?: string; issueId?: string }) => {
    const query = new URLSearchParams({ companyId });
    if (filters?.projectId) {
      query.set("projectId", filters.projectId);
    }
    if (filters?.issueId) {
      query.set("issueId", filters.issueId);
    }
    return apiRequest<ExecutionWorkspace[]>(`/execution-workspaces?${query.toString()}`, token);
  },
  createExecutionWorkspace: (token: string, companyId: string, payload: Record<string, unknown>) =>
    apiRequest<ExecutionWorkspace>(`/execution-workspaces?companyId=${companyId}`, token, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  routines: (token: string, companyId: string) => apiRequest<Routine[]>(`/routines?companyId=${companyId}`, token),
};

export function createEventStream(token: string) {
  return new EventSource(`${API_BASE}/events?token=${encodeURIComponent(token)}`);
}
