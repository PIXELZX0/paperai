import type {
  Agent,
  ApprovalRequest,
  AuthUser,
  Company,
  Issue,
  IssueComment,
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

  listCompanies() {
    return this.request<Company[]>("/companies");
  }

  listAgents(companyId: string) {
    return this.request<Agent[]>(`/agents?companyId=${encodeURIComponent(companyId)}`);
  }

  getAgent(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}`);
  }

  wakeAgent(agentId: string) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/wake`, { method: "POST" });
  }

  testAgent(agentId: string) {
    return this.request(`/agents/${encodeURIComponent(agentId)}/test`, { method: "POST" });
  }

  resetAgentSession(agentId: string) {
    return this.request<Agent>(`/agents/${encodeURIComponent(agentId)}/reset-session`, { method: "POST" });
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
}
