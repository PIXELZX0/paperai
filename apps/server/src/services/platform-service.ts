import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DomainEventBus } from "@paperai/core";
import { hasBoardPermission } from "@paperai/core";
import { parseCompanyPackage, exportCompanyPackage } from "@paperai/company-package";
import { createDatabase, schema, type Database } from "@paperai/db";
import { validatePluginManifest } from "@paperai/plugin-sdk";
import type {
  ActivityEvent,
  Agent,
  ApprovalRequest,
  AuthUser,
  BoardPermission,
  BudgetPolicy,
  Company,
  CompanyPackageManifest,
  CostEvent,
  Goal,
  HeartbeatRun,
  Invite,
  Membership,
  MembershipRole,
  Plugin,
  Project,
  Routine,
  Task,
  TaskComment,
} from "@paperai/shared";
import { hashPassword, verifyPassword } from "../lib/passwords.js";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function mapUser(row: typeof schema.users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapCompany(row: typeof schema.companies.$inferSelect): Company {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    status: row.status as Company["status"],
    brandColor: row.brandColor,
    monthlyBudgetCents: row.monthlyBudgetCents,
    spentMonthlyCents: row.spentMonthlyCents,
    packageSource: (row.packageSource as Company["packageSource"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapMembership(row: typeof schema.memberships.$inferSelect): Membership {
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    role: row.role as MembershipRole,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapInvite(row: typeof schema.invites.$inferSelect): Invite {
  return {
    id: row.id,
    companyId: row.companyId,
    email: row.email,
    role: row.role as Invite["role"],
    token: row.token,
    invitedByUserId: row.invitedByUserId,
    acceptedAt: toIso(row.acceptedAt),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapGoal(row: typeof schema.goals.$inferSelect): Goal {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: row.description,
    ownerAgentId: row.ownerAgentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProject(row: typeof schema.projects.$inferSelect): Project {
  return {
    id: row.id,
    companyId: row.companyId,
    goalId: row.goalId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    ownerAgentId: row.ownerAgentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAgent(row: typeof schema.agents.$inferSelect): Agent {
  return {
    id: row.id,
    companyId: row.companyId,
    parentAgentId: row.parentAgentId,
    slug: row.slug,
    name: row.name,
    title: row.title,
    capabilities: row.capabilities,
    status: row.status as Agent["status"],
    adapterType: row.adapterType as Agent["adapterType"],
    adapterConfig: row.adapterConfig,
    runtimeConfig: row.runtimeConfig,
    permissions: (row.permissions as Agent["permissions"]) ?? [],
    budgetMonthlyCents: row.budgetMonthlyCents,
    spentMonthlyCents: row.spentMonthlyCents,
    sessionState: row.sessionState,
    lastHeartbeatAt: toIso(row.lastHeartbeatAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapTask(row: typeof schema.tasks.$inferSelect): Task {
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

function mapTaskComment(row: typeof schema.taskComments.$inferSelect): TaskComment {
  return {
    id: row.id,
    taskId: row.taskId,
    companyId: row.companyId,
    authorUserId: row.authorUserId,
    authorAgentId: row.authorAgentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapHeartbeat(row: typeof schema.heartbeatRuns.$inferSelect): HeartbeatRun {
  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    triggerKind: row.triggerKind as HeartbeatRun["triggerKind"],
    triggerDetail: row.triggerDetail,
    status: row.status as HeartbeatRun["status"],
    taskId: row.taskId,
    error: row.error,
    result: row.result,
    usage: row.usage,
    log: row.log,
    costCents: row.costCents,
    sessionBefore: row.sessionBefore,
    sessionAfter: row.sessionAfter,
    startedAt: toIso(row.startedAt),
    finishedAt: toIso(row.finishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapApproval(row: typeof schema.approvals.$inferSelect): ApprovalRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    requestedByUserId: row.requestedByUserId,
    requestedByAgentId: row.requestedByAgentId,
    kind: row.kind as ApprovalRequest["kind"],
    status: row.status as ApprovalRequest["status"],
    title: row.title,
    description: row.description,
    payload: row.payload,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: toIso(row.resolvedAt),
    resolutionNotes: row.resolutionNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBudget(row: typeof schema.budgetPolicies.$inferSelect): BudgetPolicy {
  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    scope: row.scope as BudgetPolicy["scope"],
    monthlyLimitCents: row.monthlyLimitCents,
    hardStop: row.hardStop,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCost(row: typeof schema.costEvents.$inferSelect): CostEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    agentId: row.agentId,
    heartbeatRunId: row.heartbeatRunId,
    amountCents: row.amountCents,
    currency: row.currency,
    provider: row.provider,
    model: row.model,
    direction: row.direction as CostEvent["direction"],
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPlugin(row: typeof schema.plugins.$inferSelect): Plugin {
  return {
    id: row.id,
    companyId: row.companyId,
    slug: row.slug,
    name: row.name,
    status: row.status as Plugin["status"],
    manifest: row.manifest as unknown as Plugin["manifest"],
    config: row.config,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapRoutine(row: typeof schema.routines.$inferSelect): Routine {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    cron: row.cron,
    taskTemplate: row.taskTemplate,
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapActivity(row: typeof schema.activityEvents.$inferSelect): ActivityEvent {
  return {
    id: row.id,
    companyId: row.companyId,
    actorUserId: row.actorUserId,
    actorAgentId: row.actorAgentId,
    kind: row.kind as ActivityEvent["kind"],
    targetType: row.targetType,
    targetId: row.targetId,
    summary: row.summary,
    payload: row.payload,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PlatformService {
  constructor(
    readonly db: Database,
    private readonly eventBus: DomainEventBus,
  ) {}

  static create(connectionString: string, eventBus: DomainEventBus): PlatformService {
    return new PlatformService(createDatabase(connectionString), eventBus);
  }

  private async recordActivity(seed: {
    companyId: string;
    actorUserId?: string | null;
    actorAgentId?: string | null;
    kind: ActivityEvent["kind"];
    targetType: string;
    targetId: string;
    summary: string;
    payload?: Record<string, unknown>;
  }): Promise<ActivityEvent> {
    const event = {
      id: randomUUID(),
      companyId: seed.companyId,
      actorUserId: seed.actorUserId ?? null,
      actorAgentId: seed.actorAgentId ?? null,
      kind: seed.kind,
      targetType: seed.targetType,
      targetId: seed.targetId,
      summary: seed.summary,
      payload: seed.payload ?? {},
      createdAt: new Date(),
    };
    const [row] = await this.db.insert(schema.activityEvents).values(event).returning();
    const activity = mapActivity(row);
    this.eventBus.publish("activity", activity);
    return activity;
  }

  async registerUser(input: { email: string; name: string; password: string; inviteToken?: string | undefined }) {
    const existing = await this.db.select().from(schema.users).where(eq(schema.users.email, input.email));
    if (existing.length > 0) {
      throw new Error("email_already_registered");
    }

    const passwordHash = await hashPassword(input.password);
    const [user] = await this.db
      .insert(schema.users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash,
      })
      .returning();

    if (input.inviteToken) {
      const [invite] = await this.db.select().from(schema.invites).where(eq(schema.invites.token, input.inviteToken));
      if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
        throw new Error("invalid_invite");
      }

      await this.db.insert(schema.memberships).values({
        companyId: invite.companyId,
        userId: user.id,
        role: invite.role,
      });

      await this.db
        .update(schema.invites)
        .set({ acceptedAt: new Date() })
        .where(eq(schema.invites.id, invite.id));

      await this.recordActivity({
        companyId: invite.companyId,
        actorUserId: user.id,
        kind: "membership.created",
        targetType: "membership",
        targetId: `${invite.companyId}:${user.id}`,
        summary: `${input.email} accepted an invite`,
      });
    }

    return mapUser(user);
  }

  async login(input: { email: string; password: string }) {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, input.email));
    if (!user) {
      throw new Error("invalid_credentials");
    }

    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error("invalid_credentials");
    }

    return mapUser(user);
  }

  async getUser(userId: string): Promise<AuthUser | null> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId));
    return user ? mapUser(user) : null;
  }

  async listCompaniesForUser(userId: string): Promise<Company[]> {
    const memberships = await this.db.select().from(schema.memberships).where(eq(schema.memberships.userId, userId));
    if (memberships.length === 0) {
      return [];
    }

    const companyIds = memberships.map((membership) => membership.companyId);
    const companies = await this.db.select().from(schema.companies).where(inArray(schema.companies.id, companyIds));
    return companies.map(mapCompany);
  }

  async createCompany(
    actorUserId: string,
    input: {
      slug: string;
      name: string;
      description?: string;
      brandColor?: string;
      monthlyBudgetCents: number;
    },
  ) {
    const now = new Date();
    const [company] = await this.db
      .insert(schema.companies)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description,
        brandColor: input.brandColor,
        monthlyBudgetCents: input.monthlyBudgetCents,
        updatedAt: now,
      })
      .returning();

    await this.db.insert(schema.memberships).values({
      companyId: company.id,
      userId: actorUserId,
      role: "owner",
    });

    await this.recordActivity({
      companyId: company.id,
      actorUserId,
      kind: "company.created",
      targetType: "company",
      targetId: company.id,
      summary: `Created company ${company.name}`,
      payload: { slug: company.slug },
    });

    return mapCompany(company);
  }

  async getMembership(userId: string, companyId: string): Promise<Membership | null> {
    const [membership] = await this.db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.userId, userId), eq(schema.memberships.companyId, companyId)));
    return membership ? mapMembership(membership) : null;
  }

  async requirePermission(userId: string, companyId: string, permission: BoardPermission): Promise<Membership> {
    const membership = await this.getMembership(userId, companyId);
    if (!membership || !hasBoardPermission(membership.role, permission)) {
      throw new Error("forbidden");
    }
    return membership;
  }

  async listMemberships(companyId: string): Promise<Membership[]> {
    const rows = await this.db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.companyId, companyId))
      .orderBy(asc(schema.memberships.createdAt));
    return rows.map(mapMembership);
  }

  async createInvite(actorUserId: string, companyId: string, input: { email: string; role: MembershipRole }) {
    await this.requirePermission(actorUserId, companyId, "membership:invite");
    const [invite] = await this.db
      .insert(schema.invites)
      .values({
        companyId,
        email: input.email,
        role: input.role,
        token: randomUUID(),
        invitedByUserId: actorUserId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      })
      .returning();

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "invite.created",
      targetType: "invite",
      targetId: invite.id,
      summary: `Invited ${input.email} as ${input.role}`,
    });

    return mapInvite(invite);
  }

  async listInvites(actorUserId: string, companyId: string): Promise<Invite[]> {
    await this.requirePermission(actorUserId, companyId, "membership:invite");
    const rows = await this.db
      .select()
      .from(schema.invites)
      .where(eq(schema.invites.companyId, companyId))
      .orderBy(desc(schema.invites.createdAt));
    return rows.map(mapInvite);
  }

  async createGoal(actorUserId: string, companyId: string, input: { title: string; description?: string; ownerAgentId?: string | null }) {
    await this.requirePermission(actorUserId, companyId, "goal:write");
    const [goal] = await this.db
      .insert(schema.goals)
      .values({
        companyId,
        title: input.title,
        description: input.description,
        ownerAgentId: input.ownerAgentId ?? null,
        updatedAt: new Date(),
      })
      .returning();
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "goal.created",
      targetType: "goal",
      targetId: goal.id,
      summary: `Created goal ${goal.title}`,
    });
    return mapGoal(goal);
  }

  async listGoals(actorUserId: string, companyId: string): Promise<Goal[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db.select().from(schema.goals).where(eq(schema.goals.companyId, companyId));
    return rows.map(mapGoal);
  }

  async createProject(
    actorUserId: string,
    companyId: string,
    input: { slug: string; name: string; description?: string; goalId?: string | null; ownerAgentId?: string | null },
  ) {
    await this.requirePermission(actorUserId, companyId, "project:write");
    const [project] = await this.db
      .insert(schema.projects)
      .values({
        companyId,
        slug: input.slug,
        name: input.name,
        description: input.description,
        goalId: input.goalId ?? null,
        ownerAgentId: input.ownerAgentId ?? null,
        updatedAt: new Date(),
      })
      .returning();
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "project.created",
      targetType: "project",
      targetId: project.id,
      summary: `Created project ${project.name}`,
    });
    return mapProject(project);
  }

  async listProjects(actorUserId: string, companyId: string): Promise<Project[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db.select().from(schema.projects).where(eq(schema.projects.companyId, companyId));
    return rows.map(mapProject);
  }

  async createAgent(
    actorUserId: string,
    companyId: string,
    input: {
      slug: string;
      name: string;
      title?: string;
      capabilities?: string;
      parentAgentId?: string | null;
      adapterType: Agent["adapterType"];
      adapterConfig?: Record<string, unknown>;
      runtimeConfig?: Record<string, unknown>;
      permissions?: string[];
      budgetMonthlyCents: number;
    },
  ) {
    await this.requirePermission(actorUserId, companyId, "agent:write");
    const [agent] = await this.db
      .insert(schema.agents)
      .values({
        companyId,
        parentAgentId: input.parentAgentId ?? null,
        slug: input.slug,
        name: input.name,
        title: input.title,
        capabilities: input.capabilities,
        adapterType: input.adapterType,
        adapterConfig: input.adapterConfig ?? {},
        runtimeConfig: input.runtimeConfig ?? {},
        permissions: input.permissions ?? [],
        budgetMonthlyCents: input.budgetMonthlyCents,
        updatedAt: new Date(),
      })
      .returning();
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "agent.created",
      targetType: "agent",
      targetId: agent.id,
      summary: `Created agent ${agent.name}`,
    });
    return mapAgent(agent);
  }

  async listAgents(actorUserId: string, companyId: string): Promise<Agent[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.companyId, companyId))
      .orderBy(asc(schema.agents.createdAt));
    return rows.map(mapAgent);
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const [row] = await this.db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
    return row ? mapAgent(row) : null;
  }

  async resetAgentSession(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    const [row] = await this.db
      .update(schema.agents)
      .set({ sessionState: null, updatedAt: new Date() })
      .where(eq(schema.agents.id, agentId))
      .returning();
    await this.recordActivity({
      companyId: agent.companyId,
      actorUserId,
      kind: "agent.updated",
      targetType: "agent",
      targetId: agentId,
      summary: `Reset session for ${agent.name}`,
    });
    return mapAgent(row);
  }

  async createTask(
    actorUserId: string,
    companyId: string,
    input: {
      projectId?: string | null;
      goalId?: string | null;
      parentTaskId?: string | null;
      assigneeAgentId?: string | null;
      title: string;
      description?: string;
      status: Task["status"];
      priority: Task["priority"];
      originKind: string;
      originRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Task> {
    await this.requirePermission(actorUserId, companyId, "task:write");
    const [task] = await this.db
      .insert(schema.tasks)
      .values({
        companyId,
        projectId: input.projectId ?? null,
        goalId: input.goalId ?? null,
        parentTaskId: input.parentTaskId ?? null,
        assigneeAgentId: input.assigneeAgentId ?? null,
        createdByUserId: actorUserId,
        title: input.title,
        description: input.description,
        status: input.status,
        priority: input.priority,
        originKind: input.originKind,
        originRef: input.originRef ?? null,
        metadata: input.metadata ?? {},
        updatedAt: new Date(),
      })
      .returning();
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "task.created",
      targetType: "task",
      targetId: task.id,
      summary: `Created task ${task.title}`,
    });
    return mapTask(task);
  }

  async listTasks(actorUserId: string, companyId: string): Promise<Task[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.companyId, companyId))
      .orderBy(desc(schema.tasks.createdAt));
    return rows.map(mapTask);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const [row] = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
    return row ? mapTask(row) : null;
  }

  async updateTask(actorUserId: string, taskId: string, input: Partial<Omit<Task, "id" | "companyId" | "createdAt" | "updatedAt">>) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, task.companyId, "task:write");
    const [row] = await this.db
      .update(schema.tasks)
      .set({
        projectId: input.projectId ?? task.projectId,
        goalId: input.goalId ?? task.goalId,
        parentTaskId: input.parentTaskId ?? task.parentTaskId,
        assigneeAgentId: input.assigneeAgentId ?? task.assigneeAgentId,
        title: input.title ?? task.title,
        description: input.description ?? task.description,
        status: input.status ?? task.status,
        priority: input.priority ?? task.priority,
        originKind: input.originKind ?? task.originKind,
        originRef: input.originRef ?? task.originRef,
        metadata: input.metadata ?? task.metadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId))
      .returning();
    await this.recordActivity({
      companyId: task.companyId,
      actorUserId,
      kind: "task.updated",
      targetType: "task",
      targetId: taskId,
      summary: `Updated task ${row.title}`,
    });
    return mapTask(row);
  }

  async checkoutTask(actorUserId: string, taskId: string, agentId: string, heartbeatRunId?: string) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, task.companyId, "task:checkout");

    const [row] = await this.db
      .update(schema.tasks)
      .set({
        status: "in_progress",
        assigneeAgentId: agentId,
        checkoutHeartbeatRunId: heartbeatRunId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.tasks.id, taskId),
          inArray(schema.tasks.status, ["backlog", "todo", "blocked"]),
        ),
      )
      .returning();

    if (!row) {
      throw new Error("task_checkout_conflict");
    }

    await this.recordActivity({
      companyId: task.companyId,
      actorUserId,
      kind: "task.checked_out",
      targetType: "task",
      targetId: taskId,
      summary: `Checked out task ${row.title}`,
      payload: { agentId, heartbeatRunId },
    });

    return mapTask(row);
  }

  async addTaskComment(actorUserId: string, taskId: string, body: string) {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, task.companyId, "task:write");
    const [row] = await this.db
      .insert(schema.taskComments)
      .values({
        companyId: task.companyId,
        taskId,
        authorUserId: actorUserId,
        body,
      })
      .returning();

    await this.recordActivity({
      companyId: task.companyId,
      actorUserId,
      kind: "task.commented",
      targetType: "task_comment",
      targetId: row.id,
      summary: `Commented on task ${task.title}`,
    });

    return mapTaskComment(row);
  }

  async listTaskComments(actorUserId: string, taskId: string): Promise<TaskComment[]> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, task.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.taskComments)
      .where(eq(schema.taskComments.taskId, taskId))
      .orderBy(asc(schema.taskComments.createdAt));
    return rows.map(mapTaskComment);
  }

  async createHeartbeatRun(companyId: string, agentId: string, triggerKind: HeartbeatRun["triggerKind"], triggerDetail?: string, taskId?: string | null) {
    const [row] = await this.db
      .insert(schema.heartbeatRuns)
      .values({
        companyId,
        agentId,
        triggerKind,
        triggerDetail,
        taskId: taskId ?? null,
      })
      .returning();
    const heartbeat = mapHeartbeat(row);
    this.eventBus.publish("heartbeat", heartbeat);
    await this.recordActivity({
      companyId,
      actorAgentId: agentId,
      kind: "heartbeat.created",
      targetType: "heartbeat",
      targetId: heartbeat.id,
      summary: `Queued heartbeat for agent ${agentId}`,
      payload: { triggerKind, taskId },
    });
    return heartbeat;
  }

  async listHeartbeats(actorUserId: string, companyId: string): Promise<HeartbeatRun[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.heartbeatRuns)
      .where(eq(schema.heartbeatRuns.companyId, companyId))
      .orderBy(desc(schema.heartbeatRuns.createdAt));
    return rows.map(mapHeartbeat);
  }

  async listQueuedHeartbeats(limit = 10): Promise<HeartbeatRun[]> {
    const rows = await this.db
      .select()
      .from(schema.heartbeatRuns)
      .where(eq(schema.heartbeatRuns.status, "queued"))
      .orderBy(asc(schema.heartbeatRuns.createdAt))
      .limit(limit);
    return rows.map(mapHeartbeat);
  }

  async claimHeartbeat(id: string): Promise<HeartbeatRun | null> {
    const [row] = await this.db
      .update(schema.heartbeatRuns)
      .set({
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.heartbeatRuns.id, id), eq(schema.heartbeatRuns.status, "queued")))
      .returning();
    return row ? mapHeartbeat(row) : null;
  }

  async completeHeartbeat(id: string, input: Partial<HeartbeatRun>) {
    const [row] = await this.db
      .update(schema.heartbeatRuns)
      .set({
        status: input.status,
        error: input.error ?? null,
        result: input.result ?? null,
        usage: input.usage ?? null,
        log: input.log ?? null,
        costCents: input.costCents ?? 0,
        sessionBefore: input.sessionBefore ?? null,
        sessionAfter: input.sessionAfter ?? null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.heartbeatRuns.id, id))
      .returning();
    if (!row) {
      throw new Error("not_found");
    }
    const heartbeat = mapHeartbeat(row);
    this.eventBus.publish("heartbeat", heartbeat);
    await this.recordActivity({
      companyId: heartbeat.companyId,
      actorAgentId: heartbeat.agentId,
      kind: "heartbeat.updated",
      targetType: "heartbeat",
      targetId: heartbeat.id,
      summary: `Heartbeat ${heartbeat.status}`,
      payload: { error: heartbeat.error, costCents: heartbeat.costCents },
    });
    return heartbeat;
  }

  async createApproval(actorUserId: string, companyId: string, input: { kind: ApprovalRequest["kind"]; title: string; description?: string; payload: Record<string, unknown> }) {
    await this.requirePermission(actorUserId, companyId, "task:write");
    const [row] = await this.db
      .insert(schema.approvals)
      .values({
        companyId,
        requestedByUserId: actorUserId,
        kind: input.kind,
        title: input.title,
        description: input.description,
        payload: input.payload,
        updatedAt: new Date(),
      })
      .returning();
    const approval = mapApproval(row);
    this.eventBus.publish("approval", approval);
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "approval.created",
      targetType: "approval",
      targetId: approval.id,
      summary: `Created approval ${approval.title}`,
    });
    return approval;
  }

  async listApprovals(actorUserId: string, companyId: string): Promise<ApprovalRequest[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.companyId, companyId))
      .orderBy(desc(schema.approvals.createdAt));
    return rows.map(mapApproval);
  }

  async resolveApproval(actorUserId: string, approvalId: string, status: "approved" | "rejected", resolutionNotes?: string) {
    const [approval] = await this.db.select().from(schema.approvals).where(eq(schema.approvals.id, approvalId));
    if (!approval) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, approval.companyId, "approval:resolve");
    const [row] = await this.db
      .update(schema.approvals)
      .set({
        status,
        resolvedByUserId: actorUserId,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      })
      .where(eq(schema.approvals.id, approvalId))
      .returning();
    const resolved = mapApproval(row);
    this.eventBus.publish("approval", resolved);
    await this.recordActivity({
      companyId: approval.companyId,
      actorUserId,
      kind: "approval.resolved",
      targetType: "approval",
      targetId: approvalId,
      summary: `Resolved approval ${approval.title} as ${status}`,
    });
    return resolved;
  }

  async upsertBudgetPolicy(actorUserId: string, companyId: string, input: { agentId?: string | null; monthlyLimitCents: number; hardStop: boolean }) {
    await this.requirePermission(actorUserId, companyId, "budget:write");

    const existing = await this.db
      .select()
      .from(schema.budgetPolicies)
      .where(
        and(
          eq(schema.budgetPolicies.companyId, companyId),
          input.agentId ? eq(schema.budgetPolicies.agentId, input.agentId) : isNull(schema.budgetPolicies.agentId),
        ),
      );

    let row: typeof schema.budgetPolicies.$inferSelect;
    if (existing[0]) {
      [row] = await this.db
        .update(schema.budgetPolicies)
        .set({
          monthlyLimitCents: input.monthlyLimitCents,
          hardStop: input.hardStop,
          updatedAt: new Date(),
        })
        .where(eq(schema.budgetPolicies.id, existing[0].id))
        .returning();
    } else {
      [row] = await this.db
        .insert(schema.budgetPolicies)
        .values({
          companyId,
          agentId: input.agentId ?? null,
          scope: input.agentId ? "agent" : "company",
          monthlyLimitCents: input.monthlyLimitCents,
          hardStop: input.hardStop,
        })
        .returning();
    }

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "budget.updated",
      targetType: "budget_policy",
      targetId: row.id,
      summary: `Updated budget policy`,
      payload: { agentId: input.agentId ?? null, monthlyLimitCents: input.monthlyLimitCents },
    });

    return mapBudget(row);
  }

  async listBudgets(actorUserId: string, companyId: string): Promise<BudgetPolicy[]> {
    await this.requirePermission(actorUserId, companyId, "cost:read");
    const rows = await this.db.select().from(schema.budgetPolicies).where(eq(schema.budgetPolicies.companyId, companyId));
    return rows.map(mapBudget);
  }

  async addCostEvent(input: Omit<CostEvent, "id" | "createdAt">): Promise<CostEvent> {
    const [row] = await this.db
      .insert(schema.costEvents)
      .values({
        companyId: input.companyId,
        agentId: input.agentId,
        heartbeatRunId: input.heartbeatRunId,
        amountCents: input.amountCents,
        currency: input.currency,
        provider: input.provider,
        model: input.model,
        direction: input.direction,
      })
      .returning();
    const cost = mapCost(row);
    this.eventBus.publish("cost", cost);
    return cost;
  }

  async listCosts(actorUserId: string, companyId: string): Promise<CostEvent[]> {
    await this.requirePermission(actorUserId, companyId, "cost:read");
    const rows = await this.db
      .select()
      .from(schema.costEvents)
      .where(eq(schema.costEvents.companyId, companyId))
      .orderBy(desc(schema.costEvents.createdAt));
    return rows.map(mapCost);
  }

  async listActivity(actorUserId: string, companyId: string): Promise<ActivityEvent[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.activityEvents)
      .where(eq(schema.activityEvents.companyId, companyId))
      .orderBy(desc(schema.activityEvents.createdAt));
    return rows.map(mapActivity);
  }

  async createRoutine(actorUserId: string, companyId: string, input: { projectId?: string | null; name: string; description?: string; cron: string; taskTemplate: Record<string, unknown>; enabled: boolean }) {
    await this.requirePermission(actorUserId, companyId, "project:write");
    const [row] = await this.db
      .insert(schema.routines)
      .values({
        companyId,
        projectId: input.projectId ?? null,
        name: input.name,
        description: input.description,
        cron: input.cron,
        taskTemplate: input.taskTemplate,
        enabled: input.enabled,
        updatedAt: new Date(),
      })
      .returning();
    return mapRoutine(row);
  }

  async listRoutines(actorUserId: string, companyId: string): Promise<Routine[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db.select().from(schema.routines).where(eq(schema.routines.companyId, companyId));
    return rows.map(mapRoutine);
  }

  async createPlugin(actorUserId: string, companyId: string, input: { slug: string; name: string; manifest: Record<string, unknown>; config: Record<string, unknown> }) {
    await this.requirePermission(actorUserId, companyId, "plugin:write");
    const manifest = validatePluginManifest(input.manifest);
    const [row] = await this.db
      .insert(schema.plugins)
      .values({
        companyId,
        slug: input.slug,
        name: input.name,
        status: "active",
        manifest: manifest as unknown as Record<string, unknown>,
        config: input.config,
        updatedAt: new Date(),
      })
      .returning();
    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "plugin.created",
      targetType: "plugin",
      targetId: row.id,
      summary: `Registered plugin ${row.name}`,
    });
    return mapPlugin(row);
  }

  async validatePlugin(actorUserId: string, companyId: string, manifest: Record<string, unknown>) {
    await this.requirePermission(actorUserId, companyId, "plugin:write");
    return validatePluginManifest(manifest);
  }

  async listPlugins(actorUserId: string, companyId: string): Promise<Plugin[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db.select().from(schema.plugins).where(eq(schema.plugins.companyId, companyId));
    return rows.map(mapPlugin);
  }

  async importCompanyPackage(actorUserId: string, companyId: string, root: string): Promise<CompanyPackageManifest> {
    await this.requirePermission(actorUserId, companyId, "package:import");
    const manifest = await parseCompanyPackage(root);

    await this.db
      .update(schema.companies)
      .set({
        packageSource: {
          type: "directory",
          locator: root,
          importedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, companyId));

    for (const doc of manifest.docs) {
      if (doc.kind === "agent") {
        const [existing] = await this.db
          .select()
          .from(schema.agents)
          .where(and(eq(schema.agents.companyId, companyId), eq(schema.agents.slug, doc.slug)));

        if (!existing) {
          await this.db.insert(schema.agents).values({
            companyId,
            slug: doc.slug,
            name: String(doc.frontmatter.name ?? doc.slug),
            title: String(doc.frontmatter.title ?? ""),
            capabilities: doc.body || null,
            adapterType: "http_api",
            adapterConfig: {},
            runtimeConfig: {},
            permissions: [],
            budgetMonthlyCents: 0,
            updatedAt: new Date(),
          });
        }
      }

      if (doc.kind === "project") {
        const [existing] = await this.db
          .select()
          .from(schema.projects)
          .where(and(eq(schema.projects.companyId, companyId), eq(schema.projects.slug, doc.slug)));

        if (!existing) {
          await this.db.insert(schema.projects).values({
            companyId,
            slug: doc.slug,
            name: String(doc.frontmatter.name ?? doc.slug),
            description: doc.body || null,
            updatedAt: new Date(),
          });
        }
      }

      if (doc.kind === "task") {
        await this.db.insert(schema.tasks).values({
          companyId,
          title: String(doc.frontmatter.name ?? doc.slug),
          description: doc.body || null,
          status: "backlog",
          priority: "medium",
          originKind: "package_import",
          originRef: doc.path,
          metadata: { slug: doc.slug },
          updatedAt: new Date(),
        });
      }
    }

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "package.imported",
      targetType: "company_package",
      targetId: companyId,
      summary: `Imported company package from ${root}`,
    });

    return manifest;
  }

  async exportCompanyAsPackage(actorUserId: string, companyId: string) {
    await this.requirePermission(actorUserId, companyId, "package:export");
    const [companyRow] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!companyRow) {
      throw new Error("not_found");
    }
    const company = mapCompany(companyRow);
    const agents = await this.listAgents(actorUserId, companyId);
    const projects = await this.listProjects(actorUserId, companyId);
    const tasks = await this.listTasks(actorUserId, companyId);

    const manifest: CompanyPackageManifest = {
      root: company.slug,
      company: {
        kind: "company",
        path: "COMPANY.md",
        slug: company.slug,
        frontmatter: {
          schema: "agentcompanies/v1",
          kind: "company",
          slug: company.slug,
          name: company.name,
          description: company.description,
        },
        body: company.description ?? "",
      },
      docs: [
        {
          kind: "company",
          path: "COMPANY.md",
          slug: company.slug,
          frontmatter: {
            schema: "agentcompanies/v1",
            kind: "company",
            slug: company.slug,
            name: company.name,
            description: company.description,
          },
          body: company.description ?? "",
        },
        ...agents.map((agent) => ({
          kind: "agent" as const,
          path: `agents/${agent.slug}/AGENTS.md`,
          slug: agent.slug,
          frontmatter: {
            kind: "agent",
            slug: agent.slug,
            name: agent.name,
            title: agent.title,
          },
          body: agent.capabilities ?? "",
        })),
        ...projects.map((project) => ({
          kind: "project" as const,
          path: `projects/${project.slug}/PROJECT.md`,
          slug: project.slug,
          frontmatter: {
            kind: "project",
            slug: project.slug,
            name: project.name,
          },
          body: project.description ?? "",
        })),
        ...tasks.map((task) => ({
          kind: "task" as const,
          path: `tasks/${task.id}/TASK.md`,
          slug: task.id,
          frontmatter: {
            kind: "task",
            slug: task.id,
            name: task.title,
            status: task.status,
            priority: task.priority,
          },
          body: task.description ?? "",
        })),
      ],
      vendorConfig: {
        adapters: agents.reduce<Record<string, unknown>>((acc, agent) => {
          acc[agent.slug] = {
            type: agent.adapterType,
            adapterConfig: agent.adapterConfig,
            runtimeConfig: agent.runtimeConfig,
          };
          return acc;
        }, {}),
      },
    };

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "package.exported",
      targetType: "company_package",
      targetId: companyId,
      summary: `Exported company package`,
    });

    return exportCompanyPackage(manifest);
  }

  async updateAgentRuntimeState(agentId: string, input: Partial<Pick<Agent, "status" | "sessionState" | "lastHeartbeatAt" | "spentMonthlyCents">>) {
    const [row] = await this.db
      .update(schema.agents)
      .set({
        status: input.status,
        sessionState: input.sessionState,
        lastHeartbeatAt: input.lastHeartbeatAt ? new Date(input.lastHeartbeatAt) : undefined,
        spentMonthlyCents: input.spentMonthlyCents,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId))
      .returning();
    return mapAgent(row);
  }

  async updateCompanySpend(companyId: string, deltaCents: number) {
    const [row] = await this.db
      .update(schema.companies)
      .set({
        spentMonthlyCents: sql`${schema.companies.spentMonthlyCents} + ${deltaCents}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, companyId))
      .returning();
    return mapCompany(row);
  }
}
