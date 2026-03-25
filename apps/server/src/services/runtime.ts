import { evaluateBudget, buildExecutionInstructions, type DomainEventBus } from "@paperai/core";
import type { AdapterDefinition, Agent, HeartbeatRun, Task } from "@paperai/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { schema } from "@paperai/db";
import { PlatformService } from "./platform-service.js";

export class RuntimeOrchestrator {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly service: PlatformService,
    private readonly eventBus: DomainEventBus,
    private readonly adapters: Map<Agent["adapterType"], AdapterDefinition>,
  ) {}

  start(pollMs = 5000) {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, pollMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async requestWake(companyId: string, agentId: string, triggerKind: HeartbeatRun["triggerKind"], triggerDetail?: string, taskId?: string | null) {
    return await this.service.createHeartbeatRun(companyId, agentId, triggerKind, triggerDetail, taskId);
  }

  async testAgent(agentId: string) {
    const agent = await this.service.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    const adapter = this.adapters.get(agent.adapterType);
    if (!adapter) {
      throw new Error("unknown_adapter");
    }
    return await adapter.validateConfig(agent.adapterConfig);
  }

  private async pickTask(agent: Agent): Promise<Task | null> {
    const rows = await this.service.db
      .select()
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.companyId, agent.companyId),
          eq(schema.tasks.assigneeAgentId, agent.id),
          inArray(schema.tasks.status, ["backlog", "todo", "blocked"]),
        ),
      )
      .orderBy(asc(schema.tasks.createdAt))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      companyId: row.companyId,
      projectId: row.projectId,
      goalId: row.goalId,
      parentTaskId: row.parentTaskId,
      assigneeAgentId: row.assigneeAgentId,
      createdByUserId: row.createdByUserId,
      title: row.title,
      description: row.description,
      status: row.status as Task["status"],
      priority: row.priority as Task["priority"],
      checkoutHeartbeatRunId: row.checkoutHeartbeatRunId,
      originKind: row.originKind,
      originRef: row.originRef,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async checkoutTaskForAgent(task: Task, agent: Agent, heartbeatRunId: string): Promise<Task | null> {
    const [row] = await this.service.db
      .update(schema.tasks)
      .set({
        status: "in_progress",
        assigneeAgentId: agent.id,
        checkoutHeartbeatRunId: heartbeatRunId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tasks.id, task.id),
          inArray(schema.tasks.status, ["backlog", "todo", "blocked"]),
        ),
      )
      .returning();

    if (!row) {
      return null;
    }

    await this.service.db.insert(schema.activityEvents).values({
      id: crypto.randomUUID(),
      companyId: task.companyId,
      actorAgentId: agent.id,
      actorUserId: null,
      kind: "task.checked_out",
      targetType: "task",
      targetId: task.id,
      summary: `Checked out task ${task.title}`,
      payload: { agentId: agent.id, heartbeatRunId },
      createdAt: new Date(),
    });

    return {
      id: row.id,
      companyId: row.companyId,
      projectId: row.projectId,
      goalId: row.goalId,
      parentTaskId: row.parentTaskId,
      assigneeAgentId: row.assigneeAgentId,
      createdByUserId: row.createdByUserId,
      title: row.title,
      description: row.description,
      status: row.status as Task["status"],
      priority: row.priority as Task["priority"],
      checkoutHeartbeatRunId: row.checkoutHeartbeatRunId,
      originKind: row.originKind,
      originRef: row.originRef,
      metadata: row.metadata,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async tick() {
    const queued = await this.service.listQueuedHeartbeats(5);
    for (const candidate of queued) {
      const claimed = await this.service.claimHeartbeat(candidate.id);
      if (!claimed) {
        continue;
      }
      void this.executeClaimedHeartbeat(claimed);
    }
  }

  private async executeClaimedHeartbeat(run: HeartbeatRun) {
    const agent = await this.service.getAgent(run.agentId);
    if (!agent) {
      await this.service.completeHeartbeat(run.id, {
        status: "failed",
        error: "agent_not_found",
      });
      return;
    }

    if (agent.status === "paused" || agent.status === "terminated") {
      await this.service.completeHeartbeat(run.id, {
        status: "cancelled",
        error: agent.status === "paused" ? "agent_paused" : "agent_terminated",
      });
      return;
    }

    const companies = await this.service.db.select().from(schema.companies).where(eq(schema.companies.id, agent.companyId));
    const companyRow = companies[0];
    if (!companyRow) {
      await this.service.completeHeartbeat(run.id, {
        status: "failed",
        error: "company_not_found",
      });
      return;
    }

    const company = {
      id: companyRow.id,
      slug: companyRow.slug,
      name: companyRow.name,
      description: companyRow.description,
      status: companyRow.status as "active" | "paused" | "archived",
      brandColor: companyRow.brandColor,
      monthlyBudgetCents: companyRow.monthlyBudgetCents,
      spentMonthlyCents: companyRow.spentMonthlyCents,
      packageSource: (companyRow.packageSource as Record<string, unknown> | null) as any,
      createdAt: companyRow.createdAt.toISOString(),
      updatedAt: companyRow.updatedAt.toISOString(),
    };

    const companyBudget = evaluateBudget({
      limitCents: company.monthlyBudgetCents,
      spentCents: company.spentMonthlyCents,
    });
    const agentBudget = evaluateBudget({
      limitCents: agent.budgetMonthlyCents,
      spentCents: agent.spentMonthlyCents,
    });

    if (!companyBudget.allowed || !agentBudget.allowed) {
      await this.service.completeHeartbeat(run.id, {
        status: "failed",
        error: companyBudget.reason ?? agentBudget.reason ?? "budget_exhausted",
      });
      return;
    }

    const adapter = this.adapters.get(agent.adapterType);
    if (!adapter) {
      await this.service.completeHeartbeat(run.id, {
        status: "failed",
        error: "adapter_not_registered",
      });
      return;
    }

    await this.service.updateAgentRuntimeState(agent.id, {
      status: "running",
      lastHeartbeatAt: new Date().toISOString(),
    });

    let task = run.taskId ? await this.service.getTask(run.taskId) : await this.pickTask(agent);

    if (task && task.status !== "in_progress") {
      task = await this.checkoutTaskForAgent(task, agent, run.id);
    }

    try {
      const instructions = buildExecutionInstructions(company, agent, task);
      const result = await adapter.execute({
        company,
        agent,
        task,
        instructions,
        env: {
          PAPERAI_HEARTBEAT_RUN_ID: run.id,
        },
        session: agent.sessionState,
        cwd: typeof agent.runtimeConfig.cwd === "string" ? agent.runtimeConfig.cwd : undefined,
      });

      const costCents = result.usage?.costCents ?? 0;
      await this.service.updateAgentRuntimeState(agent.id, {
        status: result.ok ? "idle" : "error",
        sessionState: result.session ?? null,
        lastHeartbeatAt: new Date().toISOString(),
        spentMonthlyCents: agent.spentMonthlyCents + costCents,
      });
      await this.service.recordAgentSession(
        agent.id,
        run.id,
        result.session ?? null,
        result.transcript
          .map((entry) => entry.message.trim())
          .find((message) => message.length > 0)
          ?.slice(0, 240) ?? null,
      );
      await this.service.updateCompanySpend(company.id, costCents);

      if (costCents > 0) {
        await this.service.addCostEvent({
          companyId: company.id,
          agentId: agent.id,
          heartbeatRunId: run.id,
          amountCents: costCents,
          currency: "USD",
          provider: result.usage?.provider ?? agent.adapterType,
          model: result.usage?.model ?? null,
          direction: "debit",
        });
      }

      if (task) {
        await this.service.updateTask(agent.id, task.id, {
          status: result.ok ? "in_review" : "blocked",
        });
        const textLog = result.transcript.map((entry) => `[${entry.type}] ${entry.message}`).join("\n");
        await this.service.db.insert(schema.taskComments).values({
          companyId: task.companyId,
          taskId: task.id,
          authorAgentId: agent.id,
          body: textLog.slice(0, 4000) || (result.ok ? "Heartbeat completed." : "Heartbeat failed."),
        });
      }

      const heartbeat = await this.service.completeHeartbeat(run.id, {
        status: result.ok ? "succeeded" : "failed",
        error: result.error,
        usage: (result.usage as unknown as Record<string, unknown> | undefined) ?? undefined,
        result: result.result,
        log: result.transcript.map((entry) => `[${entry.type}] ${entry.message}`).join("\n"),
        costCents,
        sessionBefore: agent.sessionState,
        sessionAfter: result.session ?? null,
      });

      this.eventBus.publish("heartbeat.completed", heartbeat);
    } catch (error) {
      await this.service.updateAgentRuntimeState(agent.id, {
        status: "error",
        lastHeartbeatAt: new Date().toISOString(),
      });
      await this.service.completeHeartbeat(run.id, {
        status: "failed",
        error: error instanceof Error ? error.message : "heartbeat_execution_failed",
      });
    }
  }
}
