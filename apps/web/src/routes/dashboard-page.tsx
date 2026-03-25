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
} from "@paperai/shared";
import { useNavigate } from "react-router-dom";
import { InlineForm } from "../components/forms.js";
import { Panel } from "../components/panel.js";
import { api, createEventStream, loadSession, saveSession } from "../lib/api.js";

function useSession() {
  const [session] = useState(loadSession);
  return session;
}

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

const STATUS_TONES: Record<string, string> = {
  active: "bg-emerald-300/20 text-emerald-200",
  achieved: "bg-lime-300/20 text-lime-200",
  archived: "bg-zinc-400/15 text-zinc-300",
  backlog: "bg-zinc-300/15 text-zinc-200",
  blocked: "bg-rose-300/20 text-rose-200",
  cancelled: "bg-zinc-400/15 text-zinc-300",
  completed: "bg-emerald-300/20 text-emerald-200",
  done: "bg-emerald-300/20 text-emerald-200",
  in_progress: "bg-amber-300/20 text-amber-100",
  in_review: "bg-sky-300/20 text-sky-100",
  paused: "bg-amber-300/20 text-amber-100",
  pending: "bg-cyan-300/20 text-cyan-100",
  planned: "bg-violet-300/20 text-violet-100",
  todo: "bg-cyan-300/20 text-cyan-100",
  viewer: "bg-zinc-300/15 text-zinc-200",
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = useSession();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(() => session.selectedCompanyId ?? null);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    if (!session.token) {
      navigate("/");
    }
  }, [navigate, session.token]);

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
  const goalById = useMemo(() => new Map((goals.data ?? []).map((goal) => [goal.id, goal])), [goals.data]);
  const projectById = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );
  const activeProjects = useMemo(
    () => (projects.data ?? []).filter((project) => !project.archivedAt),
    [projects.data],
  );
  const pendingInvites = useMemo(
    () => (invites.data ?? []).filter((invite) => !invite.acceptedAt),
    [invites.data],
  );
  const activeLiveEvents = useMemo(
    () =>
      events.filter((event) => {
        const eventCompanyId = event.payload?.companyId;
        return !companyId || !eventCompanyId || eventCompanyId === companyId;
      }),
    [companyId, events],
  );

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
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["companies", session.token] });
      await queryClient.invalidateQueries({ queryKey: ["activity", company.id] });
      persistSelectedCompany(company.id);
    },
  });

  const createInvite = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createInvite(session.token!, companyId, {
        email: values.email,
        role: values.role || "viewer",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-invites", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
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
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
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
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
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
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
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
      await queryClient.invalidateQueries({ queryKey: ["activity", companyId] });
    },
  });

  if (!session.token) {
    return null;
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Board Console</p>
            <h1 className="text-4xl font-semibold text-white">Manage multiple AI companies from one control plane</h1>
            <p className="max-w-3xl text-zinc-400">
              Create companies, switch contexts instantly, invite teammates, and run each workspace with its own goals,
              projects, issues, agents, budgets, and approvals.
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="grid gap-6">
            <Panel
              title="Companies"
              actions={<Badge label={`${companies.data?.length ?? 0} total`} tone="bg-cyan-300/15 text-cyan-100" />}
            >
              {(companies.data?.length ?? 0) === 0 ? (
                <EmptyState message="No companies yet. Create your first company workspace to start operating like Paperclip." />
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
                        {company.description ? (
                          <p className="line-clamp-2 text-sm text-zinc-400">{company.description}</p>
                        ) : (
                          <p className="text-sm text-zinc-500">No description yet.</p>
                        )}
                        <div className="text-xs text-zinc-500">
                          Budget {formatCurrency(company.monthlyBudgetCents)} / month
                        </div>
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

            <Panel title="Live stream">
              {activeLiveEvents.length === 0 ? (
                <EmptyState message="Live activity will appear here as companies and agents change state." />
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
                <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                  <CompanyHero company={selectedCompany} members={members.data?.length ?? 0} pendingInvites={pendingInvites.length} />
                  <Panel title="Workspace health">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MetricTile title="Members" value={members.data?.length ?? 0} detail="People with access" />
                      <MetricTile title="Pending invites" value={pendingInvites.length} detail="Open company invites" />
                      <MetricTile title="Agents" value={agents.data?.length ?? 0} detail="Configured operators" />
                      <MetricTile title="Spend" value={formatCurrency(spent)} detail="Tracked usage this month" />
                      <MetricTile title="Projects" value={activeProjects.length} detail="Active delivery streams" />
                      <MetricTile title="Approvals" value={approvals.data?.length ?? 0} detail="Open governance items" />
                    </div>
                  </Panel>
                </section>

                <section className="grid gap-6 2xl:grid-cols-2">
                  <Panel title="Company settings">
                    <InlineForm
                      key={selectedCompany.id}
                      submitLabel="Save company settings"
                      initialValues={companySettingsInitialValues}
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
                      onSubmit={async (values) => {
                        await updateCompany.mutateAsync(values);
                      }}
                    />
                  </Panel>

                  <Panel title="Members">
                    {members.error instanceof Error ? (
                      <EmptyState message="You do not have permission to view the member roster for this company." />
                    ) : (members.data?.length ?? 0) === 0 ? (
                      <EmptyState message="No members yet beyond the creator." />
                    ) : (
                      <div className="grid gap-3">
                        {members.data?.map((member) => (
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
                        disabled={!hasCompany}
                        fields={[
                          { name: "email", label: "Email", placeholder: "teammate@example.com" },
                          {
                            name: "role",
                            label: "Role",
                            options: MEMBERSHIP_ROLES.map((role) => ({ label: role, value: role })),
                            emptyLabel: "viewer",
                          },
                        ]}
                        onSubmit={async (values) => {
                          await createInvite.mutateAsync(values);
                        }}
                      />
                      {invites.error instanceof Error ? (
                        <EmptyState message="You do not have permission to invite members into this company." />
                      ) : (invites.data?.length ?? 0) === 0 ? (
                        <EmptyState message="No invites yet. Create an invite link to bring another operator into this workspace." />
                      ) : (
                        <div className="grid gap-3">
                          {invites.data?.slice(0, 6).map((invite) => (
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
                                <div className="mt-3 grid gap-2 text-xs text-zinc-400">
                                  <code className="overflow-x-auto rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-cyan-200">
                                    {buildInviteLink(invite.token)}
                                  </code>
                                  <a className="text-cyan-300 hover:text-cyan-200" href={buildInviteLink(invite.token)}>
                                    Open signup link
                                  </a>
                                </div>
                              ) : null}
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Recent activity">
                    {(activity.data?.length ?? 0) === 0 ? (
                      <EmptyState message="No activity yet. Company creation, invites, goals, and agent work will appear here." />
                    ) : (
                      <div className="grid gap-3">
                        {activity.data?.slice(0, 10).map((event: ActivityEvent) => (
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
                </section>

                <section className="grid gap-6 2xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="grid gap-6">
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
                            options: GOAL_LEVELS.map((level) => ({ label: level, value: level })),
                            emptyLabel: "task",
                          },
                          {
                            name: "status",
                            label: "Status",
                            options: GOAL_STATUSES.map((status) => ({ label: status, value: status })),
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
                            options: PROJECT_STATUSES.map((status) => ({ label: status, value: status })),
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

                    <Panel title="Extensions">
                      <div className="grid gap-3 text-sm text-zinc-300 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                          <div className="text-2xl font-semibold text-white">{plugins.data?.length ?? 0}</div>
                          <div className="mt-1 text-zinc-400">Plugins installed</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                          <div className="text-2xl font-semibold text-white">{routines.data?.length ?? 0}</div>
                          <div className="mt-1 text-zinc-400">Routines configured</div>
                        </div>
                      </div>
                    </Panel>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
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
              {props.company.description ?? "Set the operating model, team access, and execution priorities for this company workspace."}
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
