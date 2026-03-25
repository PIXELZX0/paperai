import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GOAL_LEVELS,
  GOAL_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  PROJECT_STATUSES,
  type Company,
} from "@paperai/shared";
import { useNavigate } from "react-router-dom";
import { Panel } from "../components/panel.js";
import { InlineForm } from "../components/forms.js";
import { api, createEventStream, loadSession, saveSession } from "../lib/api.js";

function useSession() {
  const [session] = useState(loadSession);
  return session;
}

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-300/20 text-emerald-200",
  achieved: "bg-lime-300/20 text-lime-200",
  backlog: "bg-zinc-300/15 text-zinc-200",
  blocked: "bg-rose-300/20 text-rose-200",
  cancelled: "bg-zinc-400/15 text-zinc-300",
  completed: "bg-emerald-300/20 text-emerald-200",
  done: "bg-emerald-300/20 text-emerald-200",
  in_progress: "bg-amber-300/20 text-amber-100",
  in_review: "bg-sky-300/20 text-sky-100",
  planned: "bg-violet-300/20 text-violet-100",
  todo: "bg-cyan-300/20 text-cyan-100",
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = useSession();
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [events, setEvents] = useState<Array<{ type: string; at: string }>>([]);

  useEffect(() => {
    if (!session.token) {
      navigate("/");
    }
  }, [navigate, session.token]);

  const companies = useQuery({
    queryKey: ["companies", session.token],
    queryFn: () => api.companies(session.token!),
    enabled: Boolean(session.token),
  });

  useEffect(() => {
    if (!selectedCompany && companies.data?.[0]) {
      setSelectedCompany(companies.data[0]);
    }
  }, [companies.data, selectedCompany]);

  useEffect(() => {
    if (!session.token) {
      return;
    }

    const stream = createEventStream(session.token);
    stream.onmessage = (event) => {
      const parsed = JSON.parse(event.data) as { type: string; at: string };
      setEvents((current) => [parsed, ...current].slice(0, 12));
      void queryClient.invalidateQueries();
    };
    return () => stream.close();
  }, [queryClient, session.token]);

  const companyId = selectedCompany?.id ?? "";
  const hasCompany = Boolean(session.token && companyId);

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

  const spent = useMemo(() => costs.data?.reduce((sum, item) => sum + item.amountCents, 0) ?? 0, [costs.data]);

  const goalById = useMemo(
    () => new Map((goals.data ?? []).map((goal) => [goal.id, goal])),
    [goals.data],
  );
  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );

  const activeProjects = (projects.data ?? []).filter((project) => !project.archivedAt);
  const agentOptions = (agents.data ?? []).map((agent) => ({
    label: `${agent.name}${agent.title ? ` · ${agent.title}` : ""}`,
    value: agent.id,
  }));
  const goalOptions = (goals.data ?? []).map((goal) => ({
    label: `${goal.title} · ${goal.level}`,
    value: goal.id,
  }));
  const projectOptions = activeProjects.map((project) => ({
    label: `${project.name} · ${project.status}`,
    value: project.id,
  }));

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
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSelectedCompany(company);
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["goals", companyId] });
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects", companyId] });
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issues", companyId] });
    },
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["agents", companyId] });
    },
  });

  if (!session.token) {
    return null;
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Board Console</p>
            <h1 className="text-4xl font-semibold text-white">Goal, project, issue orchestration</h1>
            <p className="text-zinc-400">Signed in as {session.user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
              value={selectedCompany?.id ?? ""}
              onChange={(event) => {
                const next = companies.data?.find((company) => company.id === event.target.value) ?? null;
                setSelectedCompany(next);
              }}
            >
              <option value="">Select company</option>
              {companies.data?.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <button
              className="rounded-2xl border border-white/10 px-4 py-2 text-sm"
              onClick={() => {
                saveSession({ token: null, user: null });
                navigate("/");
              }}
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-5">
          <MetricCard title="Companies" value={companies.data?.length ?? 0} detail="Operator workspaces" />
          <MetricCard title="Goals" value={goals.data?.length ?? 0} detail="Strategic direction" />
          <MetricCard title="Projects" value={activeProjects.length} detail="Execution lanes" />
          <MetricCard title="Issues" value={issues.data?.length ?? 0} detail="Tracked work items" />
          <MetricCard title="Spend" value={`$${(spent / 100).toFixed(2)}`} detail="Normalized usage events" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
          <div className="grid gap-6">
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

            <Panel title="Create agent">
              <InlineForm
                submitLabel="Add agent"
                disabled={!hasCompany}
                fields={[
                  { name: "slug", label: "Slug", placeholder: "cto" },
                  { name: "name", label: "Name", placeholder: "CTO" },
                  { name: "title", label: "Title", placeholder: "Chief Technology Officer" },
                  { name: "capabilities", label: "Capabilities", type: "textarea", rows: 3 },
                  { name: "adapterType", label: "Adapter type", placeholder: "http_api / codex / claude_code" },
                  { name: "budgetMonthlyCents", label: "Budget (cents)", type: "number" },
                ]}
                onSubmit={async (values) => {
                  await createAgent.mutateAsync(values);
                }}
              />
            </Panel>

            <Panel title="Create goal">
              <InlineForm
                submitLabel="Add goal"
                disabled={!hasCompany}
                fields={[
                  { name: "title", label: "Title", placeholder: "Reach product-market fit" },
                  { name: "description", label: "Description", type: "textarea", rows: 3 },
                  {
                    name: "level",
                    label: "Level",
                    options: GOAL_LEVELS.map((level) => ({
                      label: level,
                      value: level,
                    })),
                    emptyLabel: "task",
                  },
                  {
                    name: "status",
                    label: "Status",
                    options: GOAL_STATUSES.map((status) => ({
                      label: status,
                      value: status,
                    })),
                    emptyLabel: "planned",
                  },
                  { name: "parentId", label: "Parent goal", options: goalOptions, emptyLabel: "No parent goal" },
                  { name: "ownerAgentId", label: "Owner agent", options: agentOptions, emptyLabel: "Unassigned" },
                ]}
                onSubmit={async (values) => {
                  await createGoal.mutateAsync(values);
                }}
              />
            </Panel>

            <Panel title="Create project">
              <InlineForm
                submitLabel="Add project"
                disabled={!hasCompany}
                fields={[
                  { name: "slug", label: "Slug", placeholder: "launch-app" },
                  { name: "name", label: "Name", placeholder: "Launch app" },
                  { name: "description", label: "Description", type: "textarea", rows: 3 },
                  { name: "goalId", label: "Linked goal", options: goalOptions, emptyLabel: "No linked goal" },
                  {
                    name: "status",
                    label: "Status",
                    options: PROJECT_STATUSES.map((status) => ({
                      label: status,
                      value: status,
                    })),
                    emptyLabel: "backlog",
                  },
                  { name: "targetDate", label: "Target date", type: "date" },
                  { name: "color", label: "Accent color", placeholder: "#22c55e" },
                  { name: "ownerAgentId", label: "Owner agent", options: agentOptions, emptyLabel: "Unassigned" },
                ]}
                onSubmit={async (values) => {
                  await createProject.mutateAsync(values);
                }}
              />
            </Panel>

            <Panel title="Create issue">
              <InlineForm
                submitLabel="Add issue"
                disabled={!hasCompany}
                fields={[
                  { name: "title", label: "Title", placeholder: "Ship onboarding flow" },
                  { name: "description", label: "Description", type: "textarea", rows: 4 },
                  { name: "projectId", label: "Project", options: projectOptions, emptyLabel: "No project" },
                  { name: "goalId", label: "Goal", options: goalOptions, emptyLabel: "No goal" },
                  {
                    name: "parentId",
                    label: "Parent issue",
                    options: (issues.data ?? []).slice(0, 20).map((issue) => ({
                      label: issue.title,
                      value: issue.id,
                    })),
                    emptyLabel: "No parent issue",
                  },
                  { name: "assigneeAgentId", label: "Assignee", options: agentOptions, emptyLabel: "Unassigned" },
                  {
                    name: "status",
                    label: "Status",
                    options: ISSUE_STATUSES.map((status) => ({
                      label: status,
                      value: status,
                    })),
                    emptyLabel: "backlog",
                  },
                  {
                    name: "priority",
                    label: "Priority",
                    options: ISSUE_PRIORITIES.map((priority) => ({
                      label: priority,
                      value: priority,
                    })),
                    emptyLabel: "medium",
                  },
                ]}
                onSubmit={async (values) => {
                  await createIssue.mutateAsync(values);
                }}
              />
            </Panel>
          </div>

          <div className="grid gap-6">
            <Panel title="Goals">
              {(goals.data?.length ?? 0) === 0 ? (
                <EmptyState message="No goals yet. Start with the company mission, then break it into team and task goals." />
              ) : (
                <div className="grid gap-3">
                  {goals.data?.map((goal) => (
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
                                label={`Parent: ${goalById.get(goal.parentId)?.title ?? goal.parentId.slice(0, 8)}`}
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
              {activeProjects.length === 0 ? (
                <EmptyState message="No projects yet. Link execution streams to goals so issue context rolls up cleanly." />
              ) : (
                <div className="grid gap-3">
                  {activeProjects.map((project) => (
                    <article key={project.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            {project.color ? (
                              <span
                                className="h-3 w-3 rounded-full border border-white/20"
                                style={{ backgroundColor: project.color }}
                              />
                            ) : null}
                            <h3 className="font-medium text-white">{project.name}</h3>
                          </div>
                          {project.description ? <p className="text-sm text-zinc-400">{project.description}</p> : null}
                          <div className="flex flex-wrap gap-2">
                            <Badge label={project.status} tone={STATUS_TONES[project.status]} />
                            <Badge label={project.slug} tone="bg-white/10 text-zinc-200" />
                            {project.goalId ? (
                              <Badge
                                label={`Goal: ${goalById.get(project.goalId)?.title ?? project.goalId.slice(0, 8)}`}
                                tone="bg-cyan-300/15 text-cyan-100"
                              />
                            ) : null}
                            {project.targetDate ? (
                              <Badge label={`Target: ${project.targetDate}`} tone="bg-amber-300/15 text-amber-100" />
                            ) : null}
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
              {(issues.data?.length ?? 0) === 0 ? (
                <EmptyState message="No issues yet. Create issues inside a project to mirror Paperclip's execution loop." />
              ) : (
                <div className="grid gap-3">
                  {issues.data?.map((issue) => (
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
                                label={`Project: ${projectById.get(issue.projectId)?.name ?? issue.projectId.slice(0, 8)}`}
                                tone="bg-sky-300/15 text-sky-100"
                              />
                            ) : null}
                            {issue.goalId ? (
                              <Badge
                                label={`Goal: ${goalById.get(issue.goalId)?.title ?? issue.goalId.slice(0, 8)}`}
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
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="Agents live">
            {(agents.data?.length ?? 0) === 0 ? (
              <EmptyState message="No agents configured for this company yet." />
            ) : (
              <div className="grid gap-3">
                {agents.data?.map((agent) => (
                  <article
                    key={agent.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div>
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <p className="text-sm text-zinc-400">{agent.title ?? agent.adapterType}</p>
                    </div>
                    <button
                      className="rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-zinc-900"
                      onClick={() => {
                        void api
                          .wakeAgent(session.token!, agent.id)
                          .then(() => queryClient.invalidateQueries({ queryKey: ["heartbeats", companyId] }));
                      }}
                    >
                      Wake
                    </button>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Approvals">
            {(approvals.data?.length ?? 0) === 0 ? (
              <EmptyState message="No pending approvals." />
            ) : (
              <div className="grid gap-3">
                {approvals.data?.map((approval) => (
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
                            void api
                              .resolveApproval(session.token!, approval.id, "approved")
                              .then(() => queryClient.invalidateQueries({ queryKey: ["approvals", companyId] }));
                          }}
                        >
                          Approve
                        </button>
                        <button
                          className="rounded-full bg-rose-300 px-3 py-1 text-xs text-zinc-950"
                          onClick={() => {
                            void api
                              .resolveApproval(session.token!, approval.id, "rejected")
                              .then(() => queryClient.invalidateQueries({ queryKey: ["approvals", companyId] }));
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

          <Panel title="Heartbeats">
            {(heartbeats.data?.length ?? 0) === 0 ? (
              <EmptyState message="No heartbeats recorded yet." />
            ) : (
              <div className="grid gap-3">
                {heartbeats.data?.map((heartbeat) => (
                  <article key={heartbeat.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{heartbeat.triggerKind}</h3>
                        <p className="text-sm text-zinc-400">{heartbeat.error ?? "Completed cleanly"}</p>
                      </div>
                      <span className="text-sm text-zinc-300">{heartbeat.status}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Realtime events">
            {events.length === 0 ? (
              <EmptyState message="Live activity will appear here as goals, projects, issues, and agents change." />
            ) : (
              <div className="grid gap-2 text-sm text-zinc-300">
                {events.map((event, index) => (
                  <div
                    key={`${event.type}-${event.at}-${index}`}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <div>{event.type}</div>
                    <div className="text-xs text-zinc-500">{event.at}</div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Extensions">
            <div className="grid gap-2 text-sm text-zinc-300">
              <div>Plugins: {plugins.data?.length ?? 0}</div>
              <div>Routines: {routines.data?.length ?? 0}</div>
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function MetricCard(props: { title: string; value: string | number; detail: string }) {
  return (
    <Panel title={props.title}>
      <div className="text-3xl font-semibold text-white">{props.value}</div>
      <p className="mt-2 text-sm text-zinc-400">{props.detail}</p>
    </Panel>
  );
}

function Badge(props: { label: string; tone?: string }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.18em] ${props.tone ?? "bg-white/10 text-zinc-200"}`}
    >
      {props.label}
    </span>
  );
}

function EmptyState(props: { message: string }) {
  return <p className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-zinc-400">{props.message}</p>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
