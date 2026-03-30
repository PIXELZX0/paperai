import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GOAL_LEVELS,
  GOAL_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  MEMBERSHIP_ROLES,
  PROJECT_STATUSES,
  type ActivityEvent,
  type Company,
  type CompanyCostOverview,
  type CompanySkill,
  type ExecutionWorkspace,
  type FinanceEvent,
  type Issue,
  type IssueDocumentSummary,
  type JoinRequest,
  type Plugin,
  type PluginRuntimeActionResult,
  type ProjectWorkspace,
  type QuotaWindow,
} from "@paperai/shared";
import { useNavigate, useParams } from "react-router-dom";
import { InlineForm } from "../components/forms.js";
import { Panel } from "../components/panel.js";
import { API_BASE, api, createEventStream, loadSession, saveSession } from "../lib/api.js";

type LiveEvent = {
  type: string;
  at: string;
  payload?: {
    companyId?: string;
    summary?: string;
    title?: string;
    name?: string;
    status?: string;
  };
};

type OrgTreeNode = {
  id: string;
  name: string;
  title: string | null;
  status: string;
  children: OrgTreeNode[];
};

type OrgTree = {
  company: {
    id: string;
    name: string;
    slug: string;
  };
  agents: OrgTreeNode[];
};

type SectionId = "overview" | "org" | "costs" | "workspaces" | "issues" | "skills" | "plugins" | "secrets";

const SECTION_ITEMS: Array<{ id: SectionId; label: string; blurb: string }> = [
  { id: "overview", label: "Overview", blurb: "Operate the company, team, goals, projects, issues, and live traffic." },
  { id: "org", label: "Org", blurb: "Inspect the company org tree and export the board chart." },
  { id: "costs", label: "Costs", blurb: "Track budget health with provider, project, agent, and biller rollups." },
  { id: "workspaces", label: "Workspaces", blurb: "Provision project and execution workspaces for delivery streams." },
  { id: "issues", label: "Issue Ops", blurb: "Manage documents, attachments, and work products for active issues." },
  { id: "skills", label: "Skills", blurb: "Build a shared company skill library and scan local skill packs." },
  { id: "plugins", label: "Plugins", blurb: "Install, enable, disable, upgrade, and exercise plugin capabilities." },
  { id: "secrets", label: "Secrets", blurb: "Store local secrets for adapters, plugins, and company operations." },
];

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-300/20 text-emerald-200",
  achieved: "bg-lime-300/20 text-lime-200",
  archived: "bg-zinc-400/15 text-zinc-300",
  approved: "bg-emerald-300/20 text-emerald-200",
  backlog: "bg-zinc-300/15 text-zinc-200",
  blocked: "bg-rose-300/20 text-rose-200",
  cancelled: "bg-zinc-400/15 text-zinc-300",
  completed: "bg-emerald-300/20 text-emerald-200",
  degraded: "bg-amber-300/20 text-amber-100",
  disabled: "bg-zinc-400/15 text-zinc-300",
  done: "bg-emerald-300/20 text-emerald-200",
  healthy: "bg-emerald-300/20 text-emerald-200",
  idle: "bg-zinc-300/15 text-zinc-200",
  in_progress: "bg-amber-300/20 text-amber-100",
  in_review: "bg-sky-300/20 text-sky-100",
  paused: "bg-amber-300/20 text-amber-100",
  pending: "bg-cyan-300/20 text-cyan-100",
  planned: "bg-violet-300/20 text-violet-100",
  rejected: "bg-rose-300/20 text-rose-200",
  running: "bg-cyan-300/20 text-cyan-100",
  todo: "bg-cyan-300/20 text-cyan-100",
  viewer: "bg-zinc-300/15 text-zinc-200",
  warning: "bg-amber-300/20 text-amber-100",
};

function useSession() {
  const [session] = useState(loadSession);
  return session;
}

function isSection(value: string | undefined): value is SectionId {
  return SECTION_ITEMS.some((item) => item.id === value);
}

function parseJsonField(input: string | undefined, fallback: Record<string, unknown> = {}) {
  if (!input?.trim()) {
    return fallback;
  }
  return JSON.parse(input) as Record<string, unknown>;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams();
  const session = useSession();
  const section: SectionId = isSection(params.section) ? params.section : "overview";
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => session.selectedCompanyId ?? null);
  const [selectedWorkspaceProjectId, setSelectedWorkspaceProjectId] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [pluginActionResult, setPluginActionResult] = useState<PluginRuntimeActionResult | null>(null);

  useEffect(() => {
    if (!session.token) {
      navigate("/");
    }
  }, [navigate, session.token]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  function persistSelectedCompany(companyId: string | null) {
    setSelectedCompanyId(companyId);
    saveSession({
      token: session.token,
      user: session.user,
      selectedCompanyId: companyId,
    });
  }

  const companies = useQuery({
    queryKey: ["companies", session.token],
    queryFn: () => api.companies(session.token!),
    enabled: Boolean(session.token),
  });

  useEffect(() => {
    if (!companies.data) {
      return;
    }
    if (companies.data.length === 0) {
      if (selectedCompanyId) {
        persistSelectedCompany(null);
      }
      return;
    }
    if (selectedCompanyId && companies.data.some((company) => company.id === selectedCompanyId)) {
      return;
    }
    persistSelectedCompany(companies.data[0].id);
  }, [companies.data, selectedCompanyId]);

  useEffect(() => {
    if (!session.token) {
      return;
    }
    const stream = createEventStream(session.token);
    stream.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as LiveEvent;
      setEvents((current) => [parsed, ...current].slice(0, 20));
      void queryClient.invalidateQueries();
    };
    return () => stream.close();
  }, [queryClient, session.token]);

  const [events, setEvents] = useState<LiveEvent[]>([]);
  const selectedCompany = useMemo(
    () => companies.data?.find((company) => company.id === selectedCompanyId) ?? null,
    [companies.data, selectedCompanyId],
  );

  const companyId = selectedCompany?.id ?? "";
  const hasCompany = Boolean(session.token && companyId);

  const members = useQuery({
    queryKey: ["company-members", companyId],
    queryFn: () => api.companyMembers(session.token!, companyId),
    enabled: hasCompany,
  });

  const invites = useQuery({
    queryKey: ["company-invites", companyId],
    queryFn: () => api.invites(session.token!, companyId),
    enabled: hasCompany,
  });

  const joinRequests = useQuery({
    queryKey: ["join-requests", companyId],
    queryFn: () => api.joinRequests(session.token!, companyId),
    enabled: hasCompany,
  });

  const activity = useQuery({
    queryKey: ["activity", companyId],
    queryFn: () => api.activity(session.token!, companyId),
    enabled: hasCompany,
  });

  const goals = useQuery({
    queryKey: ["goals", companyId],
    queryFn: () => api.goals(session.token!, companyId),
    enabled: hasCompany,
  });

  const projects = useQuery({
    queryKey: ["projects", companyId],
    queryFn: () => api.projects(session.token!, companyId),
    enabled: hasCompany,
  });

  const issues = useQuery({
    queryKey: ["issues", companyId],
    queryFn: () => api.issues(session.token!, companyId),
    enabled: hasCompany,
  });

  const agents = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => api.agents(session.token!, companyId),
    enabled: hasCompany,
  });

  const approvals = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => api.approvals(session.token!, companyId),
    enabled: hasCompany,
  });

  const heartbeats = useQuery({
    queryKey: ["heartbeats", companyId],
    queryFn: () => api.heartbeats(session.token!, companyId),
    enabled: hasCompany,
  });

  const costs = useQuery({
    queryKey: ["costs", companyId],
    queryFn: () => api.costs(session.token!, companyId),
    enabled: hasCompany,
  });

  const costOverview = useQuery({
    queryKey: ["cost-overview", companyId],
    queryFn: () => api.costOverview(session.token!, companyId),
    enabled: hasCompany,
  });

  const financeEvents = useQuery({
    queryKey: ["finance-events", companyId],
    queryFn: () => api.financeEvents(session.token!, companyId),
    enabled: hasCompany,
  });

  const quotaWindows = useQuery({
    queryKey: ["quota-windows", companyId],
    queryFn: () => api.quotaWindows(session.token!, companyId),
    enabled: hasCompany,
  });

  const orgTree = useQuery({
    queryKey: ["org-tree", companyId],
    queryFn: () => api.orgTree(session.token!, companyId) as Promise<OrgTree>,
    enabled: hasCompany,
  });

  const skills = useQuery({
    queryKey: ["skills", companyId],
    queryFn: () => api.skills(session.token!, companyId),
    enabled: hasCompany,
  });

  const secrets = useQuery({
    queryKey: ["secrets", companyId],
    queryFn: () => api.secrets(session.token!, companyId),
    enabled: hasCompany,
  });

  const plugins = useQuery({
    queryKey: ["plugins", companyId],
    queryFn: () => api.plugins(session.token!, companyId),
    enabled: hasCompany,
  });

  const routines = useQuery({
    queryKey: ["routines", companyId],
    queryFn: () => api.routines(session.token!, companyId),
    enabled: hasCompany,
  });

  const executionWorkspaces = useQuery({
    queryKey: ["execution-workspaces", companyId],
    queryFn: () => api.executionWorkspaces(session.token!, companyId),
    enabled: hasCompany,
  });

  useEffect(() => {
    const firstProjectId = projects.data?.[0]?.id ?? null;
    setSelectedWorkspaceProjectId((current) =>
      current && projects.data?.some((project) => project.id === current) ? current : firstProjectId,
    );
  }, [projects.data]);

  useEffect(() => {
    const firstIssueId = issues.data?.[0]?.id ?? null;
    setSelectedIssueId((current) => (current && issues.data?.some((issue) => issue.id === current) ? current : firstIssueId));
  }, [issues.data]);

  useEffect(() => {
    const firstPluginId = plugins.data?.[0]?.id ?? null;
    setSelectedPluginId((current) =>
      current && plugins.data?.some((plugin) => plugin.id === current) ? current : firstPluginId,
    );
  }, [plugins.data]);

  const projectWorkspaces = useQuery({
    queryKey: ["project-workspaces", companyId, selectedWorkspaceProjectId],
    queryFn: () => api.projectWorkspaces(session.token!, companyId, selectedWorkspaceProjectId!),
    enabled: hasCompany && Boolean(selectedWorkspaceProjectId),
  });

  const issueDocuments = useQuery({
    queryKey: ["issue-documents", selectedIssueId],
    queryFn: () => api.issueDocuments(session.token!, selectedIssueId!),
    enabled: Boolean(session.token && selectedIssueId),
  });

  useEffect(() => {
    const firstDocumentId = issueDocuments.data?.[0]?.id ?? null;
    setSelectedDocumentId((current) =>
      current && issueDocuments.data?.some((document) => document.id === current) ? current : firstDocumentId,
    );
  }, [issueDocuments.data]);

  const issueDocumentRevisions = useQuery({
    queryKey: ["issue-document-revisions", selectedDocumentId],
    queryFn: () => api.issueDocumentRevisions(session.token!, selectedDocumentId!),
    enabled: Boolean(session.token && selectedDocumentId),
  });

  const issueAttachments = useQuery({
    queryKey: ["issue-attachments", selectedIssueId],
    queryFn: () => api.issueAttachments(session.token!, selectedIssueId!),
    enabled: Boolean(session.token && selectedIssueId),
  });

  const issueWorkProducts = useQuery({
    queryKey: ["issue-work-products", selectedIssueId],
    queryFn: () => api.issueWorkProducts(session.token!, selectedIssueId!),
    enabled: Boolean(session.token && selectedIssueId),
  });

  const pluginHealth = useQuery({
    queryKey: ["plugin-health", selectedPluginId],
    queryFn: () => api.pluginHealth(session.token!, selectedPluginId!),
    enabled: Boolean(session.token && selectedPluginId),
  });

  const selectedDocument = useMemo(
    () => issueDocuments.data?.find((document) => document.id === selectedDocumentId) ?? null,
    [issueDocuments.data, selectedDocumentId],
  );

  const spent = useMemo(() => costs.data?.reduce((sum, item) => sum + item.amountCents, 0) ?? 0, [costs.data]);
  const activeProjects = useMemo(() => (projects.data ?? []).filter((project) => !project.archivedAt), [projects.data]);
  const pendingInvites = useMemo(() => (invites.data ?? []).filter((invite) => !invite.acceptedAt), [invites.data]);
  const pendingJoinRequests = useMemo(
    () => (joinRequests.data ?? []).filter((joinRequest) => joinRequest.status === "pending"),
    [joinRequests.data],
  );
  const activeLiveEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventCompanyId = event.payload?.companyId;
        return !companyId || !eventCompanyId || eventCompanyId === companyId;
      }),
    [companyId, events],
  );

  const goalById = useMemo(() => new Map((goals.data ?? []).map((goal) => [goal.id, goal])), [goals.data]);
  const projectById = useMemo(() => new Map((projects.data ?? []).map((project) => [project.id, project])), [projects.data]);

  const agentOptions = useMemo(
    () =>
      (agents.data ?? []).map((agent) => ({
        label: `${agent.name}${agent.title ? ` · ${agent.title}` : ""}`,
        value: agent.id,
      })),
    [agents.data],
  );
  const goalOptions = useMemo(
    () =>
      (goals.data ?? []).map((goal) => ({
        label: `${goal.title} · ${goal.level}`,
        value: goal.id,
      })),
    [goals.data],
  );
  const projectOptions = useMemo(
    () =>
      activeProjects.map((project) => ({
        label: `${project.name} · ${project.status}`,
        value: project.id,
      })),
    [activeProjects],
  );
  const issueOptions = useMemo(
    () =>
      (issues.data ?? []).map((issue) => ({
        label: issue.title,
        value: issue.id,
      })),
    [issues.data],
  );
  const sectionItems = SECTION_ITEMS;
  const companySettingsInitialValues = useMemo(
    () =>
      selectedCompany
        ? {
            slug: selectedCompany.slug,
            name: selectedCompany.name,
            description: selectedCompany.description ?? "",
            status: selectedCompany.status,
            brandColor: selectedCompany.brandColor ?? "",
            monthlyBudgetCents: String(selectedCompany.monthlyBudgetCents),
          }
        : undefined,
    [selectedCompany],
  );

  const invalidateCompanyData = async () => {
    await queryClient.invalidateQueries({ queryKey: ["companies", session.token] });
    await queryClient.invalidateQueries({ queryKey: ["company-members", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["company-invites", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["join-requests", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["goals", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["issues", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["agents", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["approvals", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["heartbeats", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["costs", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["cost-overview", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["finance-events", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["quota-windows", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["org-tree", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["skills", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["secrets", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["plugins", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["routines", companyId] });
    await queryClient.invalidateQueries({ queryKey: ["execution-workspaces", companyId] });
  };

  const createCompany = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createCompany(session.token!, {
        slug: values.slug,
        name: values.name,
        description: values.description || undefined,
        brandColor: values.brandColor || undefined,
        monthlyBudgetCents: Number(values.monthlyBudgetCents || "0"),
      }),
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["companies", session.token] });
      persistSelectedCompany(company.id);
    },
  });

  const updateCompany = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.updateCompany(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        description: values.description || null,
        status: values.status || selectedCompany?.status,
        brandColor: values.brandColor || null,
        monthlyBudgetCents: Number(values.monthlyBudgetCents || "0"),
      }),
    onSuccess: async () => {
      await invalidateCompanyData();
    },
  });

  const createInvite = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createInvite(session.token!, companyId, {
        email: values.email,
        role: values.role || "viewer",
      }),
    onSuccess: invalidateCompanyData,
  });

  const resolveJoinRequest = useMutation({
    mutationFn: ({
      joinRequestId,
      status,
      role,
    }: {
      joinRequestId: string;
      status: "approved" | "rejected" | "cancelled";
      role?: string;
    }) =>
      api.resolveJoinRequest(session.token!, joinRequestId, {
        status,
        role: role || undefined,
      }),
    onSuccess: invalidateCompanyData,
  });

  const createGoal = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createGoal(session.token!, companyId, {
        title: values.title,
        description: values.description || undefined,
        level: values.level || "task",
        status: values.status || "planned",
        parentId: values.parentId || null,
        ownerAgentId: values.ownerAgentId || null,
      }),
    onSuccess: invalidateCompanyData,
  });

  const createProject = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createProject(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        description: values.description || undefined,
        goalId: values.goalId || null,
        status: values.status || "backlog",
        targetDate: values.targetDate || null,
        color: values.color || null,
        ownerAgentId: values.ownerAgentId || null,
        archivedAt: null,
      }),
    onSuccess: invalidateCompanyData,
  });

  const createIssue = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createIssue(session.token!, companyId, {
        title: values.title,
        description: values.description || undefined,
        projectId: values.projectId || null,
        goalId: values.goalId || null,
        parentId: values.parentId || null,
        assigneeAgentId: values.assigneeAgentId || null,
        status: values.status || "backlog",
        priority: values.priority || "medium",
        originKind: "manual",
        metadata: {},
      }),
    onSuccess: invalidateCompanyData,
  });

  const createAgent = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createAgent(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        title: values.title || undefined,
        capabilities: values.capabilities || undefined,
        adapterType: values.adapterType || "http_api",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: [],
        budgetMonthlyCents: Number(values.budgetMonthlyCents || "0"),
      }),
    onSuccess: invalidateCompanyData,
  });

  const createProjectWorkspace = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createProjectWorkspace(session.token!, companyId, values.projectId, {
        name: values.name,
        cwd: values.cwd || null,
        repoUrl: values.repoUrl || null,
        repoRef: values.repoRef || null,
        isPrimary: values.isPrimary === "true",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["project-workspaces", companyId, selectedWorkspaceProjectId] });
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
    },
  });

  const createExecutionWorkspace = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createExecutionWorkspace(session.token!, companyId, {
        projectId: values.projectId || null,
        issueId: values.issueId || null,
        name: values.name,
        cwd: values.cwd || null,
        repoUrl: values.repoUrl || null,
        baseRef: values.baseRef || null,
        branchName: values.branchName || null,
        mode: values.mode || "shared_workspace",
        status: values.status || "active",
      }),
    onSuccess: invalidateCompanyData,
  });

  const createSkill = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createSkill(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        description: values.description || null,
        markdown: values.markdown,
        sourceType: values.sourceType || "local_path",
        sourceLocator: values.sourceLocator || null,
      }),
    onSuccess: invalidateCompanyData,
  });

  const scanSkills = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.scanSkills(session.token!, companyId, {
        root: values.root,
        upsert: values.upsert !== "false",
      }),
    onSuccess: invalidateCompanyData,
  });

  const createSecret = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createSecret(session.token!, companyId, {
        name: values.name,
        value: values.value,
        valueHint: values.valueHint || null,
      }),
    onSuccess: invalidateCompanyData,
  });

  const createIssueDocument = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createIssueDocument(session.token!, values.issueId || selectedIssueId!, {
        key: values.key,
        title: values.title,
        format: values.format === "text" ? "text" : "markdown",
        body: values.body,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue-documents", selectedIssueId] });
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
    },
  });

  const updateIssueDocument = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.updateIssueDocument(session.token!, values.documentId, {
        title: values.title || undefined,
        format: values.format === "text" ? "text" : "markdown",
        body: values.body || undefined,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue-documents", selectedIssueId] });
      await queryClient.invalidateQueries({ queryKey: ["issue-document-revisions", selectedDocumentId] });
    },
  });

  const createIssueAttachment = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createIssueAttachment(session.token!, values.issueId || selectedIssueId!, {
        name: values.name,
        contentType: values.contentType,
        sizeBytes: Number(values.sizeBytes || "0"),
        url: values.url || null,
        metadata: parseJsonField(values.metadata),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue-attachments", selectedIssueId] });
    },
  });

  const createIssueWorkProduct = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createIssueWorkProduct(session.token!, values.issueId || selectedIssueId!, {
        kind: values.kind,
        title: values.title,
        content: parseJsonField(values.content),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issue-work-products", selectedIssueId] });
    },
  });

  const createPlugin = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createPlugin(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        manifest: parseJsonField(values.manifest),
        config: parseJsonField(values.config),
      }),
    onSuccess: invalidateCompanyData,
  });

  const setPluginStatus = useMutation({
    mutationFn: (input: { pluginId: string; status: "active" | "disabled" }) =>
      api.setPluginStatus(session.token!, input.pluginId, input.status),
    onSuccess: invalidateCompanyData,
  });

  const invokePluginTool = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.invokePluginTool(session.token!, values.pluginId || selectedPluginId!, values.toolName, parseJsonField(values.input)),
    onSuccess: async (result) => {
      setPluginActionResult(result);
      await queryClient.invalidateQueries({ queryKey: ["plugin-health", selectedPluginId] });
    },
  });

  const triggerPluginJob = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.triggerPluginJob(session.token!, values.pluginId || selectedPluginId!, values.jobKey, parseJsonField(values.input)),
    onSuccess: (result) => {
      setPluginActionResult(result);
    },
  });

  const triggerPluginWebhook = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.triggerPluginWebhook(
        session.token!,
        values.pluginId || selectedPluginId!,
        values.webhookKey,
        parseJsonField(values.payload),
      ),
    onSuccess: (result) => {
      setPluginActionResult(result);
    },
  });

  async function downloadOrgChart(format: "svg" | "png") {
    const response = await fetch(`${API_BASE}/org-chart.${format}?companyId=${encodeURIComponent(companyId)}`, {
      headers: {
        authorization: `Bearer ${session.token}`,
      },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedCompany?.slug ?? "company"}-org-chart.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!session.token) {
    return null;
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Operating Control Plane</p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">
              Run companies, workspaces, agents, plugins, and issue artifacts from one board
            </h1>
            <p className="max-w-3xl text-zinc-400">
              PaperAI now operates more like a full operator console: bootstrap companies, manage org structure,
              provision workspaces, publish skills, protect secrets, and attach execution artifacts to issues.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300"
              onClick={() => setCommandPaletteOpen(true)}
            >
              Command palette
              <span className="ml-2 text-xs text-zinc-500">Ctrl/Cmd+K</span>
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              {session.user?.email}
            </div>
            <button
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm"
              onClick={() => {
                saveSession({ token: null, user: null, selectedCompanyId: null });
                navigate("/");
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="grid gap-6">
            <Panel
              title="Companies"
              actions={<Badge label={`${companies.data?.length ?? 0} total`} tone="bg-cyan-300/15 text-cyan-100" />}
            >
              {(companies.data?.length ?? 0) === 0 ? (
                <EmptyState message="No companies yet. Create the first operating workspace to start managing agents and workstreams." />
              ) : (
                <div className="grid gap-3">
                  {companies.data?.map((company) => {
                    const selected = company.id === companyId;
                    return (
                      <button
                        key={company.id}
                        className={`grid gap-3 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? "border-cyan-300/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/30"
                            : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/6"
                        }`}
                        onClick={() => persistSelectedCompany(company.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span
                              className="mt-1 h-3 w-3 rounded-full border border-white/20"
                              style={{ backgroundColor: company.brandColor ?? "#22d3ee" }}
                            />
                            <div>
                              <div className="font-medium text-white">{company.name}</div>
                              <div className="text-xs text-zinc-500">{company.slug}</div>
                            </div>
                          </div>
                          <Badge label={company.status} tone={STATUS_TONES[company.status]} />
                        </div>
                        <p className="text-sm text-zinc-400">{company.description ?? "No description yet."}</p>
                        <div className="text-xs text-zinc-500">Budget {formatCurrency(company.monthlyBudgetCents)} / month</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel title="Create company">
              <InlineForm
                submitLabel="Create company"
                fields={[
                  { name: "slug", label: "Slug", placeholder: "paperai-studio" },
                  { name: "name", label: "Name", placeholder: "PaperAI Studio" },
                  { name: "description", label: "Description", type: "textarea", rows: 3 },
                  { name: "brandColor", label: "Brand color", placeholder: "#06b6d4" },
                  { name: "monthlyBudgetCents", label: "Monthly budget (cents)", type: "number" },
                ]}
                onSubmit={async (values) => {
                  await createCompany.mutateAsync(values);
                }}
              />
            </Panel>

            <Panel title="Navigation">
              <div className="grid gap-3">
                <select
                  className="rounded-2xl border border-white/10 bg-zinc-950/70 px-3 py-2 text-white md:hidden"
                  value={section}
                  onChange={(event) => navigate(`/app/${event.target.value}`)}
                >
                  {sectionItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <div className="hidden gap-2 md:grid">
                  {sectionItems.map((item) => (
                    <button
                      key={item.id}
                      className={`rounded-2xl border px-4 py-3 text-left ${
                        item.id === section
                          ? "border-cyan-300/60 bg-cyan-400/10 text-white"
                          : "border-white/10 bg-black/20 text-zinc-300 hover:border-white/20"
                      }`}
                      onClick={() => navigate(`/app/${item.id}`)}
                    >
                      <div className="font-medium">{item.label}</div>
                      <div className="mt-1 text-xs text-zinc-500">{item.blurb}</div>
                    </button>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Live stream">
              {activeLiveEvents.length === 0 ? (
                <EmptyState message="Live board events will appear here as companies, agents, and workspaces change state." />
              ) : (
                <div className="grid gap-2 text-sm text-zinc-300">
                  {activeLiveEvents.slice(0, 8).map((event, index) => (
                    <div
                      key={`${event.type}-${event.at}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3"
                    >
                      <div className="font-medium text-white">{event.payload?.summary ?? getEventLabel(event)}</div>
                      <div className="mt-1 text-xs text-zinc-500">{formatDateTime(event.at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </aside>

          <div className="grid gap-6">
            {!selectedCompany ? (
              <Panel title="Select company">
                <EmptyState message="Choose a company from the left rail or create a new one to unlock company-specific controls." />
              </Panel>
            ) : (
              <>
                <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <CompanyHero company={selectedCompany} members={members.data?.length ?? 0} pendingInvites={pendingInvites.length} />
                  <Panel title="Board health">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricTile title="Members" value={members.data?.length ?? 0} detail="Humans with access to the board" />
                      <MetricTile title="Agents" value={agents.data?.length ?? 0} detail="Configured operator runtimes" />
                      <MetricTile title="Issues" value={issues.data?.length ?? 0} detail="Execution backlog and current work" />
                      <MetricTile title="Workspaces" value={(executionWorkspaces.data?.length ?? 0) + (projectWorkspaces.data?.length ?? 0)} detail="Provisioned project and execution spaces" />
                      <MetricTile title="Spend" value={formatCurrency(spent)} detail="Tracked month-to-date usage" />
                      <MetricTile title="Plugins" value={plugins.data?.length ?? 0} detail="Installed extensions and tools" />
                    </div>
                  </Panel>
                </section>

                {section === "overview" ? (
                  <OverviewSection
                    company={selectedCompany}
                    companySettingsInitialValues={companySettingsInitialValues}
                    members={members.data ?? []}
                    invites={invites.data ?? []}
                    joinRequests={joinRequests.data ?? []}
                    pendingInvites={pendingInvites.length}
                    pendingJoinRequests={pendingJoinRequests.length}
                    activity={activity.data ?? []}
                    goals={goals.data ?? []}
                    projects={activeProjects}
                    issues={issues.data ?? []}
                    approvals={approvals.data ?? []}
                    heartbeats={heartbeats.data ?? []}
                    agents={agents.data ?? []}
                    plugins={plugins.data ?? []}
                    routines={routines.data ?? []}
                    goalById={goalById}
                    projectById={projectById}
                    agentOptions={agentOptions}
                    goalOptions={goalOptions}
                    projectOptions={projectOptions}
                    issueOptions={issueOptions}
                    onWakeAgent={(agentId) =>
                      api.wakeAgent(session.token!, agentId).then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["heartbeats", companyId] });
                      })
                    }
                    onApprove={(approvalId, status) =>
                      api.resolveApproval(session.token!, approvalId, status).then(async () => {
                        await queryClient.invalidateQueries({ queryKey: ["approvals", companyId] });
                      })
                    }
                    onUpdateCompany={async (values) => {
                      await updateCompany.mutateAsync(values);
                    }}
                    onCreateInvite={async (values) => {
                      await createInvite.mutateAsync(values);
                    }}
                    onResolveJoinRequest={async (joinRequestId, status, role) => {
                      await resolveJoinRequest.mutateAsync({ joinRequestId, status, role });
                    }}
                    onCreateGoal={async (values) => {
                      await createGoal.mutateAsync(values);
                    }}
                    onCreateProject={async (values) => {
                      await createProject.mutateAsync(values);
                    }}
                    onCreateIssue={async (values) => {
                      await createIssue.mutateAsync(values);
                    }}
                    onCreateAgent={async (values) => {
                      await createAgent.mutateAsync(values);
                    }}
                  />
                ) : null}

                {section === "org" ? (
                  <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <Panel
                      title="Org tree"
                      actions={
                        <div className="flex gap-2">
                          <button className="rounded-full bg-cyan-300 px-3 py-1 text-xs font-medium text-zinc-950" onClick={() => void downloadOrgChart("svg")}>
                            Export SVG
                          </button>
                          <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white" onClick={() => void downloadOrgChart("png")}>
                            Export PNG
                          </button>
                        </div>
                      }
                    >
                      {!orgTree.data || orgTree.data.agents.length === 0 ? (
                        <EmptyState message="No agents have been added yet, so the org tree is still empty." />
                      ) : (
                        <div className="grid gap-4">
                          {orgTree.data.agents.map((node) => (
                            <OrgNodeCard key={node.id} node={node} />
                          ))}
                        </div>
                      )}
                    </Panel>
                    <Panel title="Operator notes">
                      <div className="grid gap-3 text-sm text-zinc-300">
                        <InfoCard title="Root agents" value={orgTree.data?.agents.length ?? 0} detail="Agents without parents become the board roots." />
                        <InfoCard
                          title="Company slug"
                          value={orgTree.data?.company.slug ?? selectedCompany.slug}
                          detail="Used in exports and board-level routing."
                        />
                        <InfoCard
                          title="Runtime states"
                          value={(agents.data ?? []).filter((agent) => agent.status === "running").length}
                          detail="Agents currently running a heartbeat."
                        />
                      </div>
                    </Panel>
                  </section>
                ) : null}

                {section === "costs" ? (
                  <CostSection
                    overview={costOverview.data}
                    financeEvents={financeEvents.data ?? []}
                    quotaWindows={quotaWindows.data ?? []}
                    agents={agents.data ?? []}
                    projects={projects.data ?? []}
                  />
                ) : null}

                {section === "workspaces" ? (
                  <WorkspaceSection
                    projects={activeProjects}
                    issues={issues.data ?? []}
                    selectedWorkspaceProjectId={selectedWorkspaceProjectId}
                    setSelectedWorkspaceProjectId={setSelectedWorkspaceProjectId}
                    projectWorkspaces={projectWorkspaces.data ?? []}
                    executionWorkspaces={executionWorkspaces.data ?? []}
                    onCreateProjectWorkspace={async (values) => {
                      await createProjectWorkspace.mutateAsync(values);
                    }}
                    onCreateExecutionWorkspace={async (values) => {
                      await createExecutionWorkspace.mutateAsync(values);
                    }}
                  />
                ) : null}

                {section === "issues" ? (
                  <IssueOpsSection
                    issues={issues.data ?? []}
                    selectedIssueId={selectedIssueId}
                    setSelectedIssueId={setSelectedIssueId}
                    issueDocuments={issueDocuments.data ?? []}
                    selectedDocument={selectedDocument}
                    setSelectedDocumentId={setSelectedDocumentId}
                    issueDocumentRevisions={issueDocumentRevisions.data ?? []}
                    issueAttachments={issueAttachments.data ?? []}
                    issueWorkProducts={issueWorkProducts.data ?? []}
                    onCreateDocument={async (values) => {
                      await createIssueDocument.mutateAsync(values);
                    }}
                    onUpdateDocument={async (values) => {
                      await updateIssueDocument.mutateAsync(values);
                    }}
                    onCreateAttachment={async (values) => {
                      await createIssueAttachment.mutateAsync(values);
                    }}
                    onCreateWorkProduct={async (values) => {
                      await createIssueWorkProduct.mutateAsync(values);
                    }}
                  />
                ) : null}

                {section === "skills" ? (
                  <SkillSection
                    skills={skills.data ?? []}
                    onCreateSkill={async (values) => {
                      await createSkill.mutateAsync(values);
                    }}
                    onScanSkills={async (values) => {
                      await scanSkills.mutateAsync(values);
                    }}
                  />
                ) : null}

                {section === "plugins" ? (
                  <PluginSection
                    plugins={plugins.data ?? []}
                    selectedPluginId={selectedPluginId}
                    setSelectedPluginId={setSelectedPluginId}
                    pluginHealth={pluginHealth.data ?? null}
                    actionResult={pluginActionResult}
                    onCreatePlugin={async (values) => {
                      await createPlugin.mutateAsync(values);
                    }}
                    onSetPluginStatus={async (pluginId, status) => {
                      await setPluginStatus.mutateAsync({ pluginId, status });
                    }}
                    onInvokeTool={async (values) => {
                      await invokePluginTool.mutateAsync(values);
                    }}
                    onTriggerJob={async (values) => {
                      await triggerPluginJob.mutateAsync(values);
                    }}
                    onTriggerWebhook={async (values) => {
                      await triggerPluginWebhook.mutateAsync(values);
                    }}
                  />
                ) : null}

                {section === "secrets" ? (
                  <SecretSection
                    secrets={secrets.data ?? []}
                    onCreateSecret={async (values) => {
                      await createSecret.mutateAsync(values);
                    }}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {commandPaletteOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 py-18 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950/95 p-5 shadow-2xl shadow-black/40">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Command palette</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Jump to an operator section</h2>
              </div>
              <button className="rounded-full border border-white/10 px-3 py-1 text-sm text-zinc-300" onClick={() => setCommandPaletteOpen(false)}>
                Close
              </button>
            </div>
            <div className="grid gap-3">
              {sectionItems.map((item) => (
                <button
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left hover:border-cyan-300/50"
                  onClick={() => {
                    setCommandPaletteOpen(false);
                    navigate(`/app/${item.id}`);
                  }}
                >
                  <div className="font-medium text-white">{item.label}</div>
                  <div className="mt-1 text-sm text-zinc-400">{item.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function OverviewSection(props: {
  company: Company;
  companySettingsInitialValues?: Record<string, string>;
  members: Array<{ id: string; role: string; createdAt: string; user: { name: string; email: string } }>;
  invites: Array<{ id: string; email: string; role: string; token: string; acceptedAt: string | null; expiresAt: string; createdAt: string }>;
  joinRequests: JoinRequest[];
  pendingInvites: number;
  pendingJoinRequests: number;
  activity: ActivityEvent[];
  goals: Array<{ id: string; title: string; description: string | null; level: string; status: string; parentId: string | null; createdAt: string }>;
  projects: Array<{ id: string; name: string; description: string | null; status: string; slug: string; goalId: string | null; targetDate: string | null; color: string | null; createdAt: string }>;
  issues: Issue[];
  approvals: Array<{ id: string; title: string; description: string | null }>;
  heartbeats: Array<{ id: string; triggerKind: string; error: string | null; status: string }>;
  agents: Array<{ id: string; name: string; title: string | null; adapterType: string; status: string }>;
  plugins: Plugin[];
  routines: Array<{ id: string }>;
  goalById: Map<string, { title: string }>;
  projectById: Map<string, { name: string }>;
  agentOptions: Array<{ label: string; value: string }>;
  goalOptions: Array<{ label: string; value: string }>;
  projectOptions: Array<{ label: string; value: string }>;
  issueOptions: Array<{ label: string; value: string }>;
  onWakeAgent(agentId: string): Promise<unknown>;
  onApprove(approvalId: string, status: "approved" | "rejected"): Promise<unknown>;
  onUpdateCompany(values: Record<string, string>): Promise<void>;
  onCreateInvite(values: Record<string, string>): Promise<void>;
  onResolveJoinRequest(joinRequestId: string, status: "approved" | "rejected", role?: string): Promise<unknown>;
  onCreateGoal(values: Record<string, string>): Promise<void>;
  onCreateProject(values: Record<string, string>): Promise<void>;
  onCreateIssue(values: Record<string, string>): Promise<void>;
  onCreateAgent(values: Record<string, string>): Promise<void>;
}) {
  return (
    <>
      <section className="grid gap-6 2xl:grid-cols-2">
        <Panel title="Company settings">
          <InlineForm
            key={props.company.id}
            submitLabel="Save company settings"
            initialValues={props.companySettingsInitialValues}
            fields={[
              { name: "slug", label: "Slug" },
              { name: "name", label: "Name" },
              { name: "description", label: "Description", type: "textarea", rows: 3 },
              {
                name: "status",
                label: "Status",
                options: [
                  { label: "active", value: "active" },
                  { label: "paused", value: "paused" },
                  { label: "archived", value: "archived" },
                ],
              },
              { name: "brandColor", label: "Brand color" },
              { name: "monthlyBudgetCents", label: "Monthly budget (cents)", type: "number" },
            ]}
            onSubmit={props.onUpdateCompany}
          />
        </Panel>

        <Panel title="Members">
          {props.members.length === 0 ? (
            <EmptyState message="No members yet beyond the creator." />
          ) : (
            <div className="grid gap-3">
              {props.members.map((member) => (
                <article key={member.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">{member.user.name}</h3>
                      <p className="text-sm text-zinc-400">{member.user.email}</p>
                    </div>
                    <Badge label={member.role} tone={STATUS_TONES[member.role] ?? "bg-white/10 text-zinc-200"} />
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">Joined {formatDate(member.createdAt)}</div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Invite teammates">
          <div className="grid gap-4">
            <InlineForm
              submitLabel="Create invite"
              fields={[
                { name: "email", label: "Email", placeholder: "teammate@example.com" },
                {
                  name: "role",
                  label: "Role",
                  options: MEMBERSHIP_ROLES.map((role) => ({ label: role, value: role })),
                  emptyLabel: "viewer",
                },
              ]}
              onSubmit={props.onCreateInvite}
            />
            {props.invites.length === 0 ? (
              <EmptyState message="No invites yet. Create an invite to bring another operator into this company." />
            ) : (
              <div className="grid gap-3">
                {props.invites.slice(0, 6).map((invite) => (
                  <article key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{invite.email}</h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge label={invite.role} tone="bg-cyan-300/15 text-cyan-100" />
                          <Badge
                            label={invite.acceptedAt ? "accepted" : "pending"}
                            tone={invite.acceptedAt ? "bg-emerald-300/20 text-emerald-200" : "bg-amber-300/20 text-amber-100"}
                          />
                        </div>
                      </div>
                      <div className="text-right text-xs text-zinc-500">
                        <div>Expires {formatDate(invite.expiresAt)}</div>
                        <div>Created {formatDate(invite.createdAt)}</div>
                      </div>
                    </div>
                    {!invite.acceptedAt ? (
                      <code className="mt-3 block overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs text-cyan-200">
                        {buildInviteLink(invite.token)}
                      </code>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Recent activity">
          {props.activity.length === 0 ? (
            <EmptyState message="No activity yet. Changes to companies, issues, and workspaces will appear here." />
          ) : (
            <div className="grid gap-3">
              {props.activity.slice(0, 10).map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">{event.summary}</h3>
                      <p className="text-sm text-zinc-400">
                        {event.kind} · {event.targetType}
                      </p>
                    </div>
                    <div className="text-xs text-zinc-500">{formatDateTime(event.createdAt)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Join requests">
          {props.joinRequests.length === 0 ? (
            <EmptyState message="No join requests are waiting for board review." />
          ) : (
            <div className="grid gap-3">
              {props.joinRequests.slice(0, 6).map((joinRequest) => (
                <article key={joinRequest.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <h3 className="font-medium text-white">
                        {joinRequest.kind === "human"
                          ? joinRequest.email ?? "Human join request"
                          : joinRequest.agentDraft?.name ?? "Agent join request"}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge label={joinRequest.kind} tone="bg-cyan-300/15 text-cyan-100" />
                        <Badge label={joinRequest.status} tone={STATUS_TONES[joinRequest.status] ?? "bg-white/10 text-zinc-200"} />
                        {joinRequest.role ? <Badge label={joinRequest.role} tone="bg-white/10 text-zinc-200" /> : null}
                        {joinRequest.kind === "agent" && joinRequest.agentDraft?.adapterType ? (
                          <Badge label={joinRequest.agentDraft.adapterType} tone="bg-amber-300/15 text-amber-100" />
                        ) : null}
                      </div>
                      {joinRequest.note ? <p className="text-sm text-zinc-400">{joinRequest.note}</p> : null}
                    </div>
                    <div className="text-right text-xs text-zinc-500">
                      <div>Created {formatDate(joinRequest.createdAt)}</div>
                      {joinRequest.resolvedAt ? <div>Resolved {formatDate(joinRequest.resolvedAt)}</div> : null}
                    </div>
                  </div>
                  {joinRequest.status === "pending" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        className="rounded-full bg-emerald-300 px-3 py-1 text-xs font-medium text-zinc-950"
                        onClick={() => {
                          void props.onResolveJoinRequest(joinRequest.id, "approved", joinRequest.role ?? undefined);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-full bg-rose-300 px-3 py-1 text-xs font-medium text-zinc-950"
                        onClick={() => {
                          void props.onResolveJoinRequest(joinRequest.id, "rejected");
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-6">
          <Panel title="Create agent">
            <InlineForm
              submitLabel="Add agent"
              fields={[
                { name: "slug", label: "Slug", placeholder: "cto" },
                { name: "name", label: "Name", placeholder: "CTO" },
                { name: "title", label: "Title", placeholder: "Chief Technology Officer" },
                { name: "capabilities", label: "Capabilities", type: "textarea", rows: 3 },
                { name: "adapterType", label: "Adapter type", placeholder: "http_api / openclaw_gateway / codex / hermes" },
                { name: "budgetMonthlyCents", label: "Budget (cents)", type: "number" },
              ]}
              onSubmit={props.onCreateAgent}
            />
          </Panel>

          <Panel title="Create goal">
            <InlineForm
              submitLabel="Add goal"
              fields={[
                { name: "title", label: "Title", placeholder: "Reach product-market fit" },
                { name: "description", label: "Description", type: "textarea", rows: 3 },
                {
                  name: "level",
                  label: "Level",
                  options: GOAL_LEVELS.map((level) => ({ label: level, value: level })),
                  emptyLabel: "task",
                },
                {
                  name: "status",
                  label: "Status",
                  options: GOAL_STATUSES.map((status) => ({ label: status, value: status })),
                  emptyLabel: "planned",
                },
                { name: "parentId", label: "Parent goal", options: props.goalOptions, emptyLabel: "No parent goal" },
                { name: "ownerAgentId", label: "Owner agent", options: props.agentOptions, emptyLabel: "Unassigned" },
              ]}
              onSubmit={props.onCreateGoal}
            />
          </Panel>

          <Panel title="Create project">
            <InlineForm
              submitLabel="Add project"
              fields={[
                { name: "slug", label: "Slug", placeholder: "launch-app" },
                { name: "name", label: "Name", placeholder: "Launch app" },
                { name: "description", label: "Description", type: "textarea", rows: 3 },
                { name: "goalId", label: "Linked goal", options: props.goalOptions, emptyLabel: "No linked goal" },
                {
                  name: "status",
                  label: "Status",
                  options: PROJECT_STATUSES.map((status) => ({ label: status, value: status })),
                  emptyLabel: "backlog",
                },
                { name: "targetDate", label: "Target date", type: "date" },
                { name: "color", label: "Accent color", placeholder: "#22c55e" },
                { name: "ownerAgentId", label: "Owner agent", options: props.agentOptions, emptyLabel: "Unassigned" },
              ]}
              onSubmit={props.onCreateProject}
            />
          </Panel>

          <Panel title="Create issue">
            <InlineForm
              submitLabel="Add issue"
              fields={[
                { name: "title", label: "Title", placeholder: "Ship onboarding flow" },
                { name: "description", label: "Description", type: "textarea", rows: 4 },
                { name: "projectId", label: "Project", options: props.projectOptions, emptyLabel: "No project" },
                { name: "goalId", label: "Goal", options: props.goalOptions, emptyLabel: "No goal" },
                { name: "parentId", label: "Parent issue", options: props.issueOptions, emptyLabel: "No parent issue" },
                { name: "assigneeAgentId", label: "Assignee", options: props.agentOptions, emptyLabel: "Unassigned" },
                {
                  name: "status",
                  label: "Status",
                  options: ISSUE_STATUSES.map((status) => ({ label: status, value: status })),
                  emptyLabel: "backlog",
                },
                {
                  name: "priority",
                  label: "Priority",
                  options: ISSUE_PRIORITIES.map((priority) => ({ label: priority, value: priority })),
                  emptyLabel: "medium",
                },
              ]}
              onSubmit={props.onCreateIssue}
            />
          </Panel>
        </div>

        <div className="grid gap-6">
          <Panel title="Goals">
            {props.goals.length === 0 ? (
              <EmptyState message="No goals yet. Start with a company mission and then break it into team and task goals." />
            ) : (
              <div className="grid gap-3">
                {props.goals.map((goal) => (
                  <article key={goal.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h3 className="font-medium text-white">{goal.title}</h3>
                        {goal.description ? <p className="text-sm text-zinc-400">{goal.description}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Badge label={goal.level} tone="bg-white/10 text-zinc-200" />
                          <Badge label={goal.status} tone={STATUS_TONES[goal.status]} />
                          {goal.parentId ? (
                            <Badge
                              label={`Parent: ${props.goalById.get(goal.parentId)?.title ?? goal.parentId.slice(0, 8)}`}
                              tone="bg-violet-300/15 text-violet-100"
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-zinc-500">{formatDate(goal.createdAt)}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Projects">
            {props.projects.length === 0 ? (
              <EmptyState message="No projects yet. Link execution streams to goals so issue context rolls up cleanly." />
            ) : (
              <div className="grid gap-3">
                {props.projects.map((project) => (
                  <article key={project.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          {project.color ? (
                            <span className="h-3 w-3 rounded-full border border-white/20" style={{ backgroundColor: project.color }} />
                          ) : null}
                          <h3 className="font-medium text-white">{project.name}</h3>
                        </div>
                        {project.description ? <p className="text-sm text-zinc-400">{project.description}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Badge label={project.status} tone={STATUS_TONES[project.status]} />
                          <Badge label={project.slug} tone="bg-white/10 text-zinc-200" />
                          {project.goalId ? (
                            <Badge
                              label={`Goal: ${props.goalById.get(project.goalId)?.title ?? project.goalId.slice(0, 8)}`}
                              tone="bg-cyan-300/15 text-cyan-100"
                            />
                          ) : null}
                          {project.targetDate ? <Badge label={`Target: ${project.targetDate}`} tone="bg-amber-300/15 text-amber-100" /> : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-zinc-500">{formatDate(project.createdAt)}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Issue board">
            {props.issues.length === 0 ? (
              <EmptyState message="No issues yet. Create issues inside a project to mirror the execution loop." />
            ) : (
              <div className="grid gap-3">
                {props.issues.map((issue) => (
                  <article key={issue.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <h3 className="font-medium text-white">{issue.title}</h3>
                        {issue.description ? <p className="text-sm text-zinc-400">{issue.description}</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Badge label={issue.status} tone={STATUS_TONES[issue.status]} />
                          <Badge label={issue.priority} tone="bg-rose-300/15 text-rose-100" />
                          {issue.projectId ? (
                            <Badge
                              label={`Project: ${props.projectById.get(issue.projectId)?.name ?? issue.projectId.slice(0, 8)}`}
                              tone="bg-sky-300/15 text-sky-100"
                            />
                          ) : null}
                          {issue.goalId ? (
                            <Badge
                              label={`Goal: ${props.goalById.get(issue.goalId)?.title ?? issue.goalId.slice(0, 8)}`}
                              tone="bg-cyan-300/15 text-cyan-100"
                            />
                          ) : null}
                        </div>
                      </div>
                      <div className="text-right text-xs text-zinc-500">{formatDate(issue.createdAt)}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Agents live">
            {props.agents.length === 0 ? (
              <EmptyState message="No agents configured for this company yet." />
            ) : (
              <div className="grid gap-3">
                {props.agents.map((agent) => (
                  <article key={agent.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <p className="text-sm text-zinc-400">{agent.title ?? agent.adapterType}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge label={agent.status} tone={STATUS_TONES[agent.status] ?? "bg-white/10 text-zinc-200"} />
                      <button
                        className="rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-zinc-900"
                        onClick={() => {
                          void props.onWakeAgent(agent.id);
                        }}
                      >
                        Wake
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Approvals">
            {props.approvals.length === 0 ? (
              <EmptyState message="No pending approvals." />
            ) : (
              <div className="grid gap-3">
                {props.approvals.map((approval) => (
                  <article key={approval.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{approval.title}</h3>
                        <p className="text-sm text-zinc-400">{approval.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="rounded-full bg-emerald-300 px-3 py-1 text-xs text-zinc-950"
                          onClick={() => {
                            void props.onApprove(approval.id, "approved");
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full bg-rose-300 px-3 py-1 text-xs text-zinc-950"
                          onClick={() => {
                            void props.onApprove(approval.id, "rejected");
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Heartbeats and extensions">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="grid gap-3">
                {(props.heartbeats.length === 0) ? (
                  <EmptyState message="No heartbeats recorded yet." />
                ) : (
                  props.heartbeats.slice(0, 5).map((heartbeat) => (
                    <article key={heartbeat.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-medium text-white">{heartbeat.triggerKind}</h3>
                          <p className="text-sm text-zinc-400">{heartbeat.error ?? "Completed cleanly"}</p>
                        </div>
                        <Badge label={heartbeat.status} tone={STATUS_TONES[heartbeat.status] ?? "bg-white/10 text-zinc-200"} />
                      </div>
                    </article>
                  ))
                )}
              </div>
              <div className="grid gap-3 text-sm text-zinc-300">
                <InfoCard title="Pending invites" value={props.pendingInvites} detail="Approval and join pressure on the workspace." />
                <InfoCard title="Join requests" value={props.pendingJoinRequests} detail="Humans and agents waiting for board approval." />
                <InfoCard title="Plugins installed" value={props.plugins.length} detail="Installed runtime extensions and tools." />
                <InfoCard title="Routines configured" value={props.routines.length} detail="Scheduled automations defined for this company." />
              </div>
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

function CostSection(props: {
  overview: CompanyCostOverview | undefined;
  financeEvents: FinanceEvent[];
  quotaWindows: QuotaWindow[];
  agents: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
}) {
  const agentById = useMemo(() => new Map(props.agents.map((agent) => [agent.id, agent.name])), [props.agents]);
  const projectById = useMemo(() => new Map(props.projects.map((project) => [project.id, project.name])), [props.projects]);

  if (!props.overview) {
    return (
      <Panel title="Cost overview">
        <EmptyState message="No cost data has been recorded yet." />
      </Panel>
    );
  }

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-3">
        <MetricTile title="Month spend" value={formatCurrency(props.overview.summary.monthSpendCents)} detail="Total debits this month." />
        <MetricTile title="Budget" value={formatCurrency(props.overview.summary.companyBudgetCents)} detail="Configured company budget ceiling." />
        <MetricTile title="Utilization" value={`${Math.round(props.overview.summary.utilizationRatio * 100)}%`} detail="Current budget utilization ratio." />
      </section>
      <section className="grid gap-6 2xl:grid-cols-2">
        <Panel title="By agent">
          {props.overview.byAgent.length === 0 ? (
            <EmptyState message="No agent-linked spending yet." />
          ) : (
            <div className="grid gap-3">
              {props.overview.byAgent.map((item) => (
                <SpendRow key={item.agentId} label={agentById.get(item.agentId) ?? item.agentId} amountCents={item.amountCents} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="By project">
          {props.overview.byProject.length === 0 ? (
            <EmptyState message="No project-linked spending yet." />
          ) : (
            <div className="grid gap-3">
              {props.overview.byProject.map((item) => (
                <SpendRow
                  key={item.projectId ?? "unassigned"}
                  label={item.projectId ? projectById.get(item.projectId) ?? item.projectId : "Unassigned"}
                  amountCents={item.amountCents}
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="By provider">
          {props.overview.byProvider.length === 0 ? (
            <EmptyState message="No provider-linked spending yet." />
          ) : (
            <div className="grid gap-3">
              {props.overview.byProvider.map((item) => (
                <SpendRow key={item.provider} label={item.provider} amountCents={item.amountCents} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="By biller">
          {props.overview.byBiller.length === 0 ? (
            <EmptyState message="No biller rollup available yet." />
          ) : (
            <div className="grid gap-3">
              {props.overview.byBiller.map((item) => (
                <SpendRow key={item.biller} label={item.biller} amountCents={item.amountCents} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Quota windows">
          {props.quotaWindows.length === 0 ? (
            <EmptyState message="No quota windows are active yet." />
          ) : (
            <div className="grid gap-3">
              {props.quotaWindows.map((window) => (
                <article key={window.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">
                        {window.scope === "company" ? "Company budget window" : agentById.get(window.scopeRef ?? "") ?? window.scopeRef}
                      </h3>
                      <p className="text-sm text-zinc-400">
                        {formatDate(window.periodStart)} to {formatDate(window.periodEnd)}
                      </p>
                    </div>
                    <Badge label={window.status} tone={STATUS_TONES[window.status] ?? "bg-white/10 text-zinc-200"} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-zinc-300">
                    <div>Limit {formatCurrency(window.limitCents)}</div>
                    <div>Spent {formatCurrency(window.spentCents)}</div>
                    <div>Remaining {formatCurrency(window.remainingCents)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Finance events">
          {props.financeEvents.length === 0 ? (
            <EmptyState message="No finance events have been derived from cost usage yet." />
          ) : (
            <div className="grid gap-3">
              {props.financeEvents.slice(0, 8).map((event) => (
                <article key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-white">{event.provider}</h3>
                      <p className="text-sm text-zinc-400">
                        {event.projectId ? projectById.get(event.projectId) ?? event.projectId : "Unassigned"} · {event.biller}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-white">{formatCurrency(event.direction === "credit" ? -event.amountCents : event.amountCents)}</div>
                      <div className="text-xs text-zinc-500">{formatDateTime(event.createdAt)}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}

function WorkspaceSection(props: {
  projects: Array<{ id: string; name: string; status: string }>;
  issues: Issue[];
  selectedWorkspaceProjectId: string | null;
  setSelectedWorkspaceProjectId(value: string | null): void;
  projectWorkspaces: ProjectWorkspace[];
  executionWorkspaces: ExecutionWorkspace[];
  onCreateProjectWorkspace(values: Record<string, string>): Promise<void>;
  onCreateExecutionWorkspace(values: Record<string, string>): Promise<void>;
}) {
  const projectOptions = props.projects.map((project) => ({ label: `${project.name} · ${project.status}`, value: project.id }));
  const issueOptions = props.issues.map((issue) => ({ label: issue.title, value: issue.id }));

  return (
    <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-6">
        <Panel title="Create project workspace">
          <InlineForm
            submitLabel="Add project workspace"
            initialValues={props.selectedWorkspaceProjectId ? { projectId: props.selectedWorkspaceProjectId, isPrimary: "false" } : { isPrimary: "false" }}
            fields={[
              { name: "projectId", label: "Project", options: projectOptions, emptyLabel: "Select project" },
              { name: "name", label: "Name", placeholder: "main-repo" },
              { name: "cwd", label: "Working directory", placeholder: "/workspace/paperai" },
              { name: "repoUrl", label: "Repository URL", placeholder: "https://github.com/example/repo" },
              { name: "repoRef", label: "Repository ref", placeholder: "main" },
              { name: "isPrimary", label: "Primary", options: [{ label: "true", value: "true" }, { label: "false", value: "false" }], emptyLabel: "false" },
            ]}
            onSubmit={props.onCreateProjectWorkspace}
          />
        </Panel>

        <Panel title="Create execution workspace">
          <InlineForm
            submitLabel="Add execution workspace"
            fields={[
              { name: "projectId", label: "Project", options: projectOptions, emptyLabel: "No project" },
              { name: "issueId", label: "Issue", options: issueOptions, emptyLabel: "No issue" },
              { name: "name", label: "Name", placeholder: "issue-42-branch" },
              { name: "cwd", label: "Working directory", placeholder: "/workspace/paperai/issue-42" },
              { name: "repoUrl", label: "Repository URL", placeholder: "https://github.com/example/repo" },
              { name: "baseRef", label: "Base ref", placeholder: "main" },
              { name: "branchName", label: "Branch name", placeholder: "codex/issue-42" },
              {
                name: "mode",
                label: "Mode",
                options: [
                  { label: "shared_workspace", value: "shared_workspace" },
                  { label: "isolated_workspace", value: "isolated_workspace" },
                  { label: "adapter_managed", value: "adapter_managed" },
                ],
                emptyLabel: "shared_workspace",
              },
              {
                name: "status",
                label: "Status",
                options: [
                  { label: "active", value: "active" },
                  { label: "idle", value: "idle" },
                  { label: "archived", value: "archived" },
                ],
                emptyLabel: "active",
              },
            ]}
            onSubmit={props.onCreateExecutionWorkspace}
          />
        </Panel>
      </div>

      <div className="grid gap-6">
        <Panel title="Project workspaces">
          {props.projects.length === 0 ? (
            <EmptyState message="No projects available yet." />
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {props.projects.map((project) => (
                  <button
                    key={project.id}
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                      project.id === props.selectedWorkspaceProjectId ? "bg-cyan-300 text-zinc-950" : "bg-white/10 text-zinc-200"
                    }`}
                    onClick={() => props.setSelectedWorkspaceProjectId(project.id)}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
              {props.projectWorkspaces.length === 0 ? (
                <EmptyState message="This project does not have any saved workspaces yet." />
              ) : (
                <div className="grid gap-3">
                  {props.projectWorkspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} name={workspace.name} status={workspace.isPrimary ? "primary" : "secondary"} detail={workspace.cwd ?? workspace.repoUrl ?? "No repo details"} meta={[workspace.repoRef ?? "no-ref"]} />
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Execution workspaces">
          {props.executionWorkspaces.length === 0 ? (
            <EmptyState message="No execution workspaces have been provisioned yet." />
          ) : (
            <div className="grid gap-3">
              {props.executionWorkspaces.map((workspace) => (
                <WorkspaceCard
                  key={workspace.id}
                  name={workspace.name}
                  status={workspace.status}
                  detail={workspace.cwd ?? workspace.repoUrl ?? "No repo details"}
                  meta={[workspace.mode, workspace.branchName ?? "no-branch", workspace.baseRef ?? "no-base-ref"]}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

function IssueOpsSection(props: {
  issues: Issue[];
  selectedIssueId: string | null;
  setSelectedIssueId(value: string | null): void;
  issueDocuments: IssueDocumentSummary[];
  selectedDocument: IssueDocumentSummary | null;
  setSelectedDocumentId(value: string | null): void;
  issueDocumentRevisions: Array<{ id: string; createdAt: string; body: string }>;
  issueAttachments: Array<{ id: string; name: string; contentType: string; sizeBytes: number; url: string | null; createdAt: string }>;
  issueWorkProducts: Array<{ id: string; kind: string; title: string; updatedAt: string }>;
  onCreateDocument(values: Record<string, string>): Promise<void>;
  onUpdateDocument(values: Record<string, string>): Promise<void>;
  onCreateAttachment(values: Record<string, string>): Promise<void>;
  onCreateWorkProduct(values: Record<string, string>): Promise<void>;
}) {
  return (
    <section className="grid gap-6 2xl:grid-cols-[0.8fr_1.2fr]">
      <div className="grid gap-6">
        <Panel title="Select issue">
          {props.issues.length === 0 ? (
            <EmptyState message="No issues are available for artifact management yet." />
          ) : (
            <div className="grid gap-3">
              {props.issues.map((issue) => (
                <button
                  key={issue.id}
                  className={`rounded-2xl border px-4 py-4 text-left ${
                    issue.id === props.selectedIssueId ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-black/20"
                  }`}
                  onClick={() => props.setSelectedIssueId(issue.id)}
                >
                  <div className="font-medium text-white">{issue.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge label={issue.status} tone={STATUS_TONES[issue.status]} />
                    <Badge label={issue.priority} tone="bg-rose-300/15 text-rose-100" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Create issue document">
          <InlineForm
            submitLabel="Add document"
            initialValues={props.selectedIssueId ? { issueId: props.selectedIssueId, format: "markdown" } : { format: "markdown" }}
            fields={[
              { name: "issueId", label: "Issue", options: props.issues.map((issue) => ({ label: issue.title, value: issue.id })), emptyLabel: "Select issue" },
              { name: "key", label: "Key", placeholder: "implementation-plan" },
              { name: "title", label: "Title", placeholder: "Implementation plan" },
              { name: "format", label: "Format", options: [{ label: "markdown", value: "markdown" }, { label: "text", value: "text" }], emptyLabel: "markdown" },
              { name: "body", label: "Body", type: "textarea", rows: 8 },
            ]}
            onSubmit={props.onCreateDocument}
          />
        </Panel>

        <Panel title="Create attachment">
          <InlineForm
            submitLabel="Add attachment"
            initialValues={props.selectedIssueId ? { issueId: props.selectedIssueId } : undefined}
            fields={[
              { name: "issueId", label: "Issue", options: props.issues.map((issue) => ({ label: issue.title, value: issue.id })), emptyLabel: "Select issue" },
              { name: "name", label: "Name", placeholder: "diagram.png" },
              { name: "contentType", label: "Content type", placeholder: "image/png" },
              { name: "sizeBytes", label: "Size (bytes)", type: "number" },
              { name: "url", label: "URL", placeholder: "https://..." },
              { name: "metadata", label: "Metadata JSON", type: "textarea", rows: 3, placeholder: "{\"source\":\"figma\"}" },
            ]}
            onSubmit={props.onCreateAttachment}
          />
        </Panel>

        <Panel title="Create work product">
          <InlineForm
            submitLabel="Add work product"
            initialValues={props.selectedIssueId ? { issueId: props.selectedIssueId } : undefined}
            fields={[
              { name: "issueId", label: "Issue", options: props.issues.map((issue) => ({ label: issue.title, value: issue.id })), emptyLabel: "Select issue" },
              { name: "kind", label: "Kind", placeholder: "release_note" },
              { name: "title", label: "Title", placeholder: "Release note draft" },
              { name: "content", label: "Content JSON", type: "textarea", rows: 4, placeholder: "{\"body\":\"...\"}" },
            ]}
            onSubmit={props.onCreateWorkProduct}
          />
        </Panel>
      </div>

      <div className="grid gap-6">
        <Panel title="Documents and revisions">
          {props.issueDocuments.length === 0 ? (
            <EmptyState message="No issue documents have been created yet." />
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {props.issueDocuments.map((document) => (
                  <button
                    key={document.id}
                    className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                      document.id === props.selectedDocument?.id ? "bg-cyan-300 text-zinc-950" : "bg-white/10 text-zinc-200"
                    }`}
                    onClick={() => props.setSelectedDocumentId(document.id)}
                  >
                    {document.key}
                  </button>
                ))}
              </div>
              {props.selectedDocument ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-white">{props.selectedDocument.title}</div>
                        <div className="mt-1 flex gap-2">
                          <Badge label={props.selectedDocument.format} tone="bg-white/10 text-zinc-200" />
                          <Badge label={props.selectedDocument.key} tone="bg-cyan-300/15 text-cyan-100" />
                        </div>
                      </div>
                      <div className="text-xs text-zinc-500">{formatDateTime(props.selectedDocument.updatedAt)}</div>
                    </div>
                  </div>
                  <InlineForm
                    submitLabel="Update document"
                    initialValues={{
                      documentId: props.selectedDocument.id,
                      title: props.selectedDocument.title,
                      format: props.selectedDocument.format,
                    }}
                    fields={[
                      { name: "documentId", label: "Document id", placeholder: props.selectedDocument.id },
                      { name: "title", label: "Title" },
                      { name: "format", label: "Format", options: [{ label: "markdown", value: "markdown" }, { label: "text", value: "text" }], emptyLabel: props.selectedDocument.format },
                      { name: "body", label: "Body", type: "textarea", rows: 7 },
                    ]}
                    onSubmit={props.onUpdateDocument}
                  />
                  {props.issueDocumentRevisions.length === 0 ? (
                    <EmptyState message="No document revisions recorded yet." />
                  ) : (
                    <div className="grid gap-3">
                      {props.issueDocumentRevisions.map((revision) => (
                        <article key={revision.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium text-white">{revision.id.slice(0, 8)}</div>
                            <div className="text-xs text-zinc-500">{formatDateTime(revision.createdAt)}</div>
                          </div>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-zinc-300">{revision.body}</pre>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </Panel>

        <Panel title="Attachments">
          {props.issueAttachments.length === 0 ? (
            <EmptyState message="No attachments have been recorded for the selected issue." />
          ) : (
            <div className="grid gap-3">
              {props.issueAttachments.map((attachment) => (
                <article key={attachment.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{attachment.name}</div>
                      <div className="mt-1 flex gap-2">
                        <Badge label={attachment.contentType} tone="bg-white/10 text-zinc-200" />
                        <Badge label={`${attachment.sizeBytes} bytes`} tone="bg-amber-300/15 text-amber-100" />
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">{formatDateTime(attachment.createdAt)}</div>
                  </div>
                  {attachment.url ? (
                    <a className="mt-3 inline-block text-sm text-cyan-300 hover:text-cyan-200" href={attachment.url} target="_blank" rel="noreferrer">
                      Open attachment
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Work products">
          {props.issueWorkProducts.length === 0 ? (
            <EmptyState message="No work products have been published for the selected issue." />
          ) : (
            <div className="grid gap-3">
              {props.issueWorkProducts.map((item) => (
                <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="mt-1">
                        <Badge label={item.kind} tone="bg-violet-300/15 text-violet-100" />
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">{formatDateTime(item.updatedAt)}</div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

function SkillSection(props: {
  skills: CompanySkill[];
  onCreateSkill(values: Record<string, string>): Promise<void>;
  onScanSkills(values: Record<string, string>): Promise<void>;
}) {
  return (
    <section className="grid gap-6 2xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        <Panel title="Create skill">
          <InlineForm
            submitLabel="Add skill"
            initialValues={{ sourceType: "local_path" }}
            fields={[
              { name: "slug", label: "Slug", placeholder: "release-operator" },
              { name: "name", label: "Name", placeholder: "Release Operator" },
              { name: "description", label: "Description", type: "textarea", rows: 3 },
              { name: "sourceType", label: "Source type", options: [{ label: "local_path", value: "local_path" }, { label: "github", value: "github" }, { label: "url", value: "url" }], emptyLabel: "local_path" },
              { name: "sourceLocator", label: "Source locator", placeholder: "/Users/.../skills/release" },
              { name: "markdown", label: "Markdown", type: "textarea", rows: 8 },
            ]}
            onSubmit={props.onCreateSkill}
          />
        </Panel>

        <Panel title="Scan local skills">
          <InlineForm
            submitLabel="Scan skill directory"
            initialValues={{ upsert: "true" }}
            fields={[
              { name: "root", label: "Root path", placeholder: "/Users/.../.codex/skills" },
              { name: "upsert", label: "Upsert existing", options: [{ label: "true", value: "true" }, { label: "false", value: "false" }], emptyLabel: "true" },
            ]}
            onSubmit={props.onScanSkills}
          />
        </Panel>
      </div>

      <Panel title="Skill library">
        {props.skills.length === 0 ? (
          <EmptyState message="No skills have been imported for this company yet." />
        ) : (
          <div className="grid gap-3">
            {props.skills.map((skill) => (
              <article key={skill.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{skill.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge label={skill.slug} tone="bg-cyan-300/15 text-cyan-100" />
                      <Badge label={skill.sourceType} tone="bg-white/10 text-zinc-200" />
                    </div>
                    {skill.description ? <p className="mt-3 text-sm text-zinc-400">{skill.description}</p> : null}
                    {skill.sourceLocator ? <p className="mt-2 text-xs text-zinc-500">{skill.sourceLocator}</p> : null}
                  </div>
                  <div className="text-xs text-zinc-500">{formatDateTime(skill.updatedAt)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

function PluginSection(props: {
  plugins: Plugin[];
  selectedPluginId: string | null;
  setSelectedPluginId(value: string | null): void;
  pluginHealth: { status: string; message: string; checkedAt: string; capabilities: string[] } | null;
  actionResult: PluginRuntimeActionResult | null;
  onCreatePlugin(values: Record<string, string>): Promise<void>;
  onSetPluginStatus(pluginId: string, status: "active" | "disabled"): Promise<void>;
  onInvokeTool(values: Record<string, string>): Promise<void>;
  onTriggerJob(values: Record<string, string>): Promise<void>;
  onTriggerWebhook(values: Record<string, string>): Promise<void>;
}) {
  const selectedPlugin = props.plugins.find((plugin) => plugin.id === props.selectedPluginId) ?? null;

  return (
    <section className="grid gap-6 2xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-6">
        <Panel title="Install plugin">
          <InlineForm
            submitLabel="Install plugin"
            fields={[
              { name: "slug", label: "Slug", placeholder: "release-bot" },
              { name: "name", label: "Name", placeholder: "Release Bot" },
              { name: "config", label: "Config JSON", type: "textarea", rows: 4, placeholder: "{\"baseUrl\":\"...\"}" },
              {
                name: "manifest",
                label: "Manifest JSON",
                type: "textarea",
                rows: 10,
                placeholder: JSON.stringify(
                  {
                    slug: "release-bot",
                    name: "Release Bot",
                    version: "1.0.0",
                    capabilities: ["tool", "job", "webhook", "ui"],
                  },
                  null,
                  2,
                ),
              },
            ]}
            onSubmit={props.onCreatePlugin}
          />
        </Panel>

        <Panel title="Plugin runtime actions">
          {!selectedPlugin ? (
            <EmptyState message="Install or select a plugin to invoke runtime actions." />
          ) : (
            <div className="grid gap-4">
              <InlineForm
                submitLabel="Invoke tool"
                initialValues={{ pluginId: selectedPlugin.id }}
                fields={[
                  { name: "pluginId", label: "Plugin id", placeholder: selectedPlugin.id },
                  { name: "toolName", label: "Tool name", placeholder: selectedPlugin.manifest.tools?.[0]?.name ?? "tool-name" },
                  { name: "input", label: "Input JSON", type: "textarea", rows: 4, placeholder: "{\"issueId\":\"...\"}" },
                ]}
                onSubmit={props.onInvokeTool}
              />
              <InlineForm
                submitLabel="Trigger job"
                initialValues={{ pluginId: selectedPlugin.id }}
                fields={[
                  { name: "pluginId", label: "Plugin id", placeholder: selectedPlugin.id },
                  { name: "jobKey", label: "Job key", placeholder: selectedPlugin.manifest.jobs?.[0]?.key ?? "job-key" },
                  { name: "input", label: "Input JSON", type: "textarea", rows: 4, placeholder: "{\"projectId\":\"...\"}" },
                ]}
                onSubmit={props.onTriggerJob}
              />
              <InlineForm
                submitLabel="Trigger webhook"
                initialValues={{ pluginId: selectedPlugin.id }}
                fields={[
                  { name: "pluginId", label: "Plugin id", placeholder: selectedPlugin.id },
                  { name: "webhookKey", label: "Webhook key", placeholder: selectedPlugin.manifest.webhooks?.[0]?.key ?? "webhook-key" },
                  { name: "payload", label: "Payload JSON", type: "textarea", rows: 4, placeholder: "{\"event\":\"deploy.complete\"}" },
                ]}
                onSubmit={props.onTriggerWebhook}
              />
              {props.actionResult ? (
                <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">
                      {props.actionResult.kind} · {props.actionResult.key}
                    </div>
                    <Badge label={props.actionResult.ok ? "ok" : "failed"} tone={props.actionResult.ok ? "bg-emerald-300/20 text-emerald-200" : "bg-rose-300/20 text-rose-200"} />
                  </div>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-sm text-zinc-300">
                    {JSON.stringify(props.actionResult.result, null, 2)}
                  </pre>
                </article>
              ) : null}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6">
        <Panel title="Installed plugins">
          {props.plugins.length === 0 ? (
            <EmptyState message="No plugins have been installed yet." />
          ) : (
            <div className="grid gap-3">
              {props.plugins.map((plugin) => (
                <article
                  key={plugin.id}
                  className={`rounded-2xl border p-4 ${
                    plugin.id === props.selectedPluginId ? "border-cyan-300/60 bg-cyan-400/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button className="text-left" onClick={() => props.setSelectedPluginId(plugin.id)}>
                      <div className="font-medium text-white">{plugin.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Badge label={plugin.slug} tone="bg-cyan-300/15 text-cyan-100" />
                        <Badge label={plugin.status} tone={STATUS_TONES[plugin.status] ?? "bg-white/10 text-zinc-200"} />
                      </div>
                    </button>
                    <div className="flex gap-2">
                      {plugin.status === "disabled" ? (
                        <button className="rounded-full bg-emerald-300 px-3 py-1 text-xs text-zinc-950" onClick={() => void props.onSetPluginStatus(plugin.id, "active")}>
                          Enable
                        </button>
                      ) : (
                        <button className="rounded-full bg-zinc-300 px-3 py-1 text-xs text-zinc-950" onClick={() => void props.onSetPluginStatus(plugin.id, "disabled")}>
                          Disable
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {plugin.manifest.capabilities.map((capability) => (
                      <Badge key={capability} label={capability} tone="bg-white/10 text-zinc-200" />
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Plugin health">
          {!selectedPlugin ? (
            <EmptyState message="Select a plugin to inspect runtime health." />
          ) : props.pluginHealth ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-white">{selectedPlugin.name}</div>
                  <Badge label={props.pluginHealth.status} tone={STATUS_TONES[props.pluginHealth.status] ?? "bg-white/10 text-zinc-200"} />
                </div>
                <p className="mt-3 text-sm text-zinc-300">{props.pluginHealth.message}</p>
                <div className="mt-3 text-xs text-zinc-500">Checked {formatDateTime(props.pluginHealth.checkedAt)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-medium text-white">Capabilities</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {props.pluginHealth.capabilities.map((capability) => (
                    <Badge key={capability} label={capability} tone="bg-cyan-300/15 text-cyan-100" />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message="Plugin health data is not available yet." />
          )}
        </Panel>
      </div>
    </section>
  );
}

function SecretSection(props: {
  secrets: Array<{ id: string; name: string; provider: string; valueHint: string | null; updatedAt: string }>;
  onCreateSecret(values: Record<string, string>): Promise<void>;
}) {
  return (
    <section className="grid gap-6 2xl:grid-cols-[0.8fr_1.2fr]">
      <Panel title="Create secret">
        <InlineForm
          submitLabel="Store secret"
          fields={[
            { name: "name", label: "Name", placeholder: "OPENAI_API_KEY" },
            { name: "value", label: "Value", type: "textarea", rows: 4 },
            { name: "valueHint", label: "Value hint", placeholder: "sk-...9d2" },
          ]}
          onSubmit={props.onCreateSecret}
        />
      </Panel>
      <Panel title="Secret inventory">
        {props.secrets.length === 0 ? (
          <EmptyState message="No secrets have been stored for this company yet." />
        ) : (
          <div className="grid gap-3">
            {props.secrets.map((secret) => (
              <article key={secret.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{secret.name}</div>
                    <div className="mt-1 flex gap-2">
                      <Badge label={secret.provider} tone="bg-white/10 text-zinc-200" />
                      {secret.valueHint ? <Badge label={secret.valueHint} tone="bg-cyan-300/15 text-cyan-100" /> : null}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">{formatDateTime(secret.updatedAt)}</div>
                </div>
              </article>
            ))}
          </div>
        )}
      </Panel>
    </section>
  );
}

function CompanyHero(props: { company: Company; members: number; pendingInvites: number }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span
            className="mt-1 h-14 w-14 rounded-2xl border border-white/10"
            style={{ backgroundColor: props.company.brandColor ?? "#22d3ee" }}
          />
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">{props.company.slug}</p>
              <h2 className="text-3xl font-semibold text-white">{props.company.name}</h2>
            </div>
            <p className="max-w-2xl text-zinc-400">
              {props.company.description ?? "Set the operating model, team access, execution priorities, and workspace topology for this company."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge label={props.company.status} tone={STATUS_TONES[props.company.status]} />
              <Badge label={`${props.members} members`} tone="bg-white/10 text-zinc-200" />
              <Badge label={`${props.pendingInvites} open invites`} tone="bg-cyan-300/15 text-cyan-100" />
              <Badge label={`Budget ${formatCurrency(props.company.monthlyBudgetCents)}`} tone="bg-amber-300/15 text-amber-100" />
            </div>
          </div>
        </div>
        <div className="text-right text-sm text-zinc-500">
          <div>Created {formatDate(props.company.createdAt)}</div>
          <div>Updated {formatDateTime(props.company.updatedAt)}</div>
        </div>
      </div>
    </section>
  );
}

function OrgNodeCard(props: { node: OrgTreeNode; depth?: number }) {
  const depth = props.depth ?? 0;
  return (
    <div className="grid gap-3">
      <article className="rounded-2xl border border-white/10 bg-black/20 p-4" style={{ marginLeft: depth * 18 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-white">{props.node.name}</div>
            <div className="text-sm text-zinc-400">{props.node.title ?? "No title"}</div>
          </div>
          <Badge label={props.node.status} tone={STATUS_TONES[props.node.status] ?? "bg-white/10 text-zinc-200"} />
        </div>
      </article>
      {props.node.children.length > 0 ? (
        <div className="grid gap-3">
          {props.node.children.map((child) => (
            <OrgNodeCard key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceCard(props: { name: string; status: string; detail: string; meta: string[] }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-white">{props.name}</div>
          <div className="mt-1 text-sm text-zinc-400">{props.detail}</div>
        </div>
        <Badge label={props.status} tone={STATUS_TONES[props.status] ?? "bg-white/10 text-zinc-200"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.meta.map((item) => (
          <Badge key={item} label={item} tone="bg-white/10 text-zinc-200" />
        ))}
      </div>
    </article>
  );
}

function SpendRow(props: { label: string; amountCents: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
      <span className="text-sm text-zinc-300">{props.label}</span>
      <span className="font-medium text-white">{formatCurrency(props.amountCents)}</span>
    </div>
  );
}

function InfoCard(props: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-2xl font-semibold text-white">{props.value}</div>
      <div className="mt-1 text-sm text-zinc-400">{props.title}</div>
      <p className="mt-2 text-xs text-zinc-500">{props.detail}</p>
    </div>
  );
}

function MetricTile(props: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
      <div className="text-2xl font-semibold text-white">{props.value}</div>
      <div className="mt-1 text-sm text-zinc-400">{props.title}</div>
      <p className="mt-2 text-xs text-zinc-500">{props.detail}</p>
    </div>
  );
}

function Badge(props: { label: string; tone?: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${props.tone ?? "bg-white/10 text-zinc-200"}`}>
      {props.label}
    </span>
  );
}

function EmptyState(props: { message: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">
      {props.message}
    </p>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventLabel(event: LiveEvent) {
  return event.payload?.title ?? event.payload?.name ?? event.type;
}

function buildInviteLink(token: string) {
  if (typeof window === "undefined") {
    return token;
  }
  return `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
}
