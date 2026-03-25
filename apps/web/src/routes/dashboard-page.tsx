import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Company } from "@paperai/shared";
import { createEventStream, api, loadSession, saveSession } from "../lib/api.js";
import { Panel } from "../components/panel.js";
import { InlineForm } from "../components/forms.js";

function useSession() {
  const [session] = useState(loadSession);
  return session;
}

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

  const agents = useQuery({
    queryKey: ["agents", companyId],
    queryFn: () => api.agents(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const tasks = useQuery({
    queryKey: ["tasks", companyId],
    queryFn: () => api.tasks(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const approvals = useQuery({
    queryKey: ["approvals", companyId],
    queryFn: () => api.approvals(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const heartbeats = useQuery({
    queryKey: ["heartbeats", companyId],
    queryFn: () => api.heartbeats(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const costs = useQuery({
    queryKey: ["costs", companyId],
    queryFn: () => api.costs(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const plugins = useQuery({
    queryKey: ["plugins", companyId],
    queryFn: () => api.plugins(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const routines = useQuery({
    queryKey: ["routines", companyId],
    queryFn: () => api.routines(session.token!, companyId),
    enabled: Boolean(session.token && companyId),
  });

  const spent = useMemo(() => costs.data?.reduce((sum, item) => sum + item.amountCents, 0) ?? 0, [costs.data]);

  const createCompany = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createCompany(session.token!, {
        slug: values.slug,
        name: values.name,
        description: values.description,
        brandColor: values.brandColor,
        monthlyBudgetCents: Number(values.monthlyBudgetCents || "0"),
      }),
    onSuccess: async (company) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      setSelectedCompany(company);
    },
  });

  const createTask = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createTask(session.token!, companyId, {
        title: values.title,
        description: values.description,
        assigneeAgentId: values.assigneeAgentId || null,
        status: "todo",
        priority: "medium",
        originKind: "manual",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tasks", companyId] });
    },
  });

  const createAgent = useMutation({
    mutationFn: (values: Record<string, string>) =>
      api.createAgent(session.token!, companyId, {
        slug: values.slug,
        name: values.name,
        title: values.title,
        capabilities: values.capabilities,
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
            <h1 className="text-4xl font-semibold text-white">Zero-human company orchestrator</h1>
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

        <section className="grid gap-4 md:grid-cols-4">
          <Panel title="Companies">
            <div className="mb-4 text-3xl font-semibold text-white">{companies.data?.length ?? 0}</div>
            <InlineForm
              submitLabel="Create company"
              fields={[
                { name: "slug", label: "Slug" },
                { name: "name", label: "Name" },
                { name: "description", label: "Description" },
                { name: "brandColor", label: "Brand color", placeholder: "#06b6d4" },
                { name: "monthlyBudgetCents", label: "Monthly budget (cents)", type: "number" },
              ]}
              onSubmit={async (values) => {
                await createCompany.mutateAsync(values);
              }}
            />
          </Panel>
          <Panel title="Agents">
            <div className="text-3xl font-semibold">{agents.data?.length ?? 0}</div>
            <p className="mt-2 text-sm text-zinc-400">Live workforce across local and hosted adapters.</p>
          </Panel>
          <Panel title="Tasks">
            <div className="text-3xl font-semibold">{tasks.data?.length ?? 0}</div>
            <p className="mt-2 text-sm text-zinc-400">Atomic checkout and review-first execution.</p>
          </Panel>
          <Panel title="Spend">
            <div className="text-3xl font-semibold">${(spent / 100).toFixed(2)}</div>
            <p className="mt-2 text-sm text-zinc-400">Tracked from normalized usage events.</p>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="grid gap-6">
            <Panel title="Create agent">
              <InlineForm
                submitLabel="Add agent"
                fields={[
                  { name: "slug", label: "Slug" },
                  { name: "name", label: "Name" },
                  { name: "title", label: "Title" },
                  { name: "capabilities", label: "Capabilities" },
                  { name: "adapterType", label: "Adapter type", placeholder: "http_api / codex / claude_code" },
                  { name: "budgetMonthlyCents", label: "Budget (cents)", type: "number" },
                ]}
                onSubmit={async (values) => {
                  await createAgent.mutateAsync(values);
                }}
              />
            </Panel>
            <Panel title="Create task">
              <InlineForm
                submitLabel="Add task"
                fields={[
                  { name: "title", label: "Title" },
                  { name: "description", label: "Description" },
                  { name: "assigneeAgentId", label: "Assignee agent ID" },
                ]}
                onSubmit={async (values) => {
                  await createTask.mutateAsync(values);
                }}
              />
            </Panel>
            <Panel title="Task board">
              <div className="grid gap-3">
                {tasks.data?.map((task) => (
                  <article key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{task.title}</h3>
                        <p className="text-sm text-zinc-400">{task.description}</p>
                      </div>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-zinc-300">
                        {task.status}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6">
            <Panel title="Agents live">
              <div className="grid gap-3">
                {agents.data?.map((agent) => (
                  <article key={agent.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div>
                      <h3 className="font-medium text-white">{agent.name}</h3>
                      <p className="text-sm text-zinc-400">{agent.title ?? agent.adapterType}</p>
                    </div>
                    <button
                      className="rounded-full bg-amber-300 px-3 py-1 text-sm font-medium text-zinc-900"
                      onClick={() => {
                        void api.wakeAgent(session.token!, agent.id).then(() => queryClient.invalidateQueries({ queryKey: ["heartbeats", companyId] }));
                      }}
                    >
                      Wake
                    </button>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Approvals">
              <div className="grid gap-3">
                {approvals.data?.map((approval) => (
                  <article key={approval.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium text-white">{approval.title}</h3>
                        <p className="text-sm text-zinc-400">{approval.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button className="rounded-full bg-emerald-300 px-3 py-1 text-xs text-zinc-950" onClick={() => void api.resolveApproval(session.token!, approval.id, "approved").then(() => queryClient.invalidateQueries({ queryKey: ["approvals", companyId] }))}>
                          Approve
                        </button>
                        <button className="rounded-full bg-rose-300 px-3 py-1 text-xs text-zinc-950" onClick={() => void api.resolveApproval(session.token!, approval.id, "rejected").then(() => queryClient.invalidateQueries({ queryKey: ["approvals", companyId] }))}>
                          Reject
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
            <Panel title="Heartbeats">
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
            </Panel>
            <Panel title="Realtime events">
              <div className="grid gap-2 text-sm text-zinc-300">
                {events.map((event, index) => (
                  <div key={`${event.type}-${event.at}-${index}`} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div>{event.type}</div>
                    <div className="text-xs text-zinc-500">{event.at}</div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Extensions">
              <div className="grid gap-2 text-sm text-zinc-300">
                <div>Plugins: {plugins.data?.length ?? 0}</div>
                <div>Routines: {routines.data?.length ?? 0}</div>
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}
