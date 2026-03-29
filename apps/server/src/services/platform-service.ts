import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DomainEventBus } from "@paperai/core";
import { hasBoardPermission } from "@paperai/core";
import { parseCompanyPackage, exportCompanyPackage } from "@paperai/company-package";
import { createDatabase, schema, type Database } from "@paperai/db";
import { validatePluginManifest } from "@paperai/plugin-sdk";
import { Resvg } from "@resvg/resvg-js";
import type {
  ActivityEvent,
  Agent,
  AgentApiKeyCreated,
  AgentRuntimeState,
  AgentSession,
  ApprovalRequest,
  AuthUser,
  BoardPermission,
  BoardApiKeyCreated,
  BoardClaimChallenge,
  BootstrapCeoResult,
  CliAuthChallengeStatus,
  BudgetPolicy,
  CompanyCostOverview,
  Company,
  CompanyMember,
  CompanyPackageManifest,
  CompanySkill,
  CostEvent,
  CostSummary,
  CostSummaryByAgent,
  CostSummaryByBiller,
  CostSummaryByProject,
  CostSummaryByProvider,
  ExecutionWorkspace,
  FinanceEvent,
  Goal,
  HeartbeatRun,
  IssueAttachment,
  Issue,
  IssueComment,
  IssueDocument,
  IssueDocumentRevision,
  IssueDocumentSummary,
  IssueWorkProduct,
  Invite,
  JoinRequest,
  JoinRequestAgentDraft,
  JoinRequestResolution,
  Membership,
  MembershipRole,
  Plugin,
  PluginHealth,
  PluginRuntimeActionResult,
  Project,
  ProjectWorkspace,
  QuotaWindow,
  Routine,
  Secret,
  Task,
  TaskComment,
} from "@paperai/shared";
import { hashPassword, verifyPassword } from "../lib/passwords.js";
import { executePluginRuntime, getPluginUiBridgeMount } from "../lib/plugin-runtime.js";

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createOpaqueToken(prefix: string): string {
  return `paperai_${prefix}_${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`;
}

function createChallengeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isSecretReference(value: unknown): value is { $secret: string } {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { $secret?: unknown }).$secret === "string" &&
      (value as { $secret: string }).$secret.length > 0,
  );
}

async function collectSkillFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const found: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await collectSkillFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name === "SKILL.md") {
      found.push(fullPath);
    }
  }

  return found;
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

function mapCompanyMember(
  membership: Membership,
  user: Pick<typeof schema.users.$inferSelect, "id" | "email" | "name">,
): CompanyMember {
  return {
    ...membership,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
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
    onboardingTitle: row.onboardingTitle,
    onboardingBody: row.onboardingBody,
    manifest: row.manifest,
    acceptedAt: toIso(row.acceptedAt),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function mapJoinRequest(row: typeof schema.joinRequests.$inferSelect): JoinRequest {
  return {
    id: row.id,
    companyId: row.companyId,
    kind: row.kind as JoinRequest["kind"],
    status: row.status as JoinRequest["status"],
    requestedByUserId: row.requestedByUserId,
    requestedByAgentId: row.requestedByAgentId,
    email: row.email,
    role: (row.role as MembershipRole | null) ?? null,
    note: row.note,
    onboardingTitle: row.onboardingTitle,
    onboardingBody: row.onboardingBody,
    manifest: row.manifest,
    agentDraft: (row.agentDraft as JoinRequestAgentDraft | null) ?? null,
    resolvedByUserId: row.resolvedByUserId,
    resolvedAt: toIso(row.resolvedAt),
    resolutionNotes: row.resolutionNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapBoardClaimChallenge(row: typeof schema.boardClaimChallenges.$inferSelect): BoardClaimChallenge {
  return {
    id: row.id,
    token: row.token,
    code: row.code,
    claimedByUserId: row.claimedByUserId,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    claimedAt: toIso(row.claimedAt),
  };
}

function mapCliAuthChallenge(row: typeof schema.cliAuthChallenges.$inferSelect): CliAuthChallengeStatus {
  return {
    id: row.id,
    challengeToken: row.challengeToken,
    requestedByUserId: row.requestedByUserId,
    approvedByUserId: row.approvedByUserId,
    boardApiKeyId: row.boardApiKeyId,
    approved: Boolean(row.approvedAt),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    approvedAt: toIso(row.approvedAt),
    consumedAt: toIso(row.consumedAt),
    boardToken: row.approvedToken,
    name: row.name,
  };
}

function mapGoal(row: typeof schema.goals.$inferSelect): Goal {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    description: row.description,
    level: row.level as Goal["level"],
    status: row.status as Goal["status"],
    parentId: row.parentId,
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
    status: row.status as Project["status"],
    targetDate: row.targetDate ?? null,
    color: row.color,
    archivedAt: toIso(row.archivedAt),
    ownerAgentId: row.ownerAgentId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapProjectWorkspace(row: typeof schema.projectWorkspaces.$inferSelect): ProjectWorkspace {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    name: row.name,
    cwd: row.cwd,
    repoUrl: row.repoUrl,
    repoRef: row.repoRef,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapExecutionWorkspace(row: typeof schema.executionWorkspaces.$inferSelect): ExecutionWorkspace {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    issueId: row.issueId,
    name: row.name,
    cwd: row.cwd,
    repoUrl: row.repoUrl,
    baseRef: row.baseRef,
    branchName: row.branchName,
    mode: row.mode as ExecutionWorkspace["mode"],
    status: row.status as ExecutionWorkspace["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapCompanySkill(row: typeof schema.companySkills.$inferSelect): CompanySkill {
  return {
    id: row.id,
    companyId: row.companyId,
    slug: row.slug,
    name: row.name,
    description: row.description,
    markdown: row.markdown,
    sourceType: row.sourceType as CompanySkill["sourceType"],
    sourceLocator: row.sourceLocator,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapSecret(row: typeof schema.secrets.$inferSelect): Secret {
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    provider: row.provider as Secret["provider"],
    valueHint: row.valueHint,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapIssue(row: typeof schema.tasks.$inferSelect): Issue {
  return {
    id: row.id,
    companyId: row.companyId,
    projectId: row.projectId,
    goalId: row.goalId,
    parentId: row.parentTaskId,
    assigneeAgentId: row.assigneeAgentId,
    createdByUserId: row.createdByUserId,
    title: row.title,
    description: row.description,
    status: row.status as Issue["status"],
    priority: row.priority as Issue["priority"],
    checkoutHeartbeatRunId: row.checkoutHeartbeatRunId,
    originKind: row.originKind,
    originRef: row.originRef,
    metadata: row.metadata,
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

function mapIssueComment(row: typeof schema.taskComments.$inferSelect): IssueComment {
  return {
    id: row.id,
    issueId: row.taskId,
    companyId: row.companyId,
    authorUserId: row.authorUserId,
    authorAgentId: row.authorAgentId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapIssueDocumentSummary(row: typeof schema.issueDocuments.$inferSelect): IssueDocumentSummary {
  return {
    id: row.id,
    issueId: row.issueId,
    key: row.key,
    title: row.title,
    format: row.format as IssueDocumentSummary["format"],
    latestRevisionId: row.latestRevisionId,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapIssueDocument(row: typeof schema.issueDocuments.$inferSelect): IssueDocument {
  return {
    ...mapIssueDocumentSummary(row),
    body: row.body,
  };
}

function mapIssueDocumentRevision(row: typeof schema.issueDocumentRevisions.$inferSelect): IssueDocumentRevision {
  return {
    id: row.id,
    documentId: row.documentId,
    body: row.body,
    createdByUserId: row.createdByUserId,
    createdByAgentId: row.createdByAgentId,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapIssueAttachment(row: typeof schema.issueAttachments.$inferSelect): IssueAttachment {
  return {
    id: row.id,
    companyId: row.companyId,
    issueId: row.issueId,
    name: row.name,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    url: row.url,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapIssueWorkProduct(row: typeof schema.issueWorkProducts.$inferSelect): IssueWorkProduct {
  return {
    id: row.id,
    issueId: row.issueId,
    kind: row.kind,
    title: row.title,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function taskFromIssue(issue: Issue): Task {
  return {
    id: issue.id,
    companyId: issue.companyId,
    projectId: issue.projectId,
    goalId: issue.goalId,
    parentTaskId: issue.parentId,
    assigneeAgentId: issue.assigneeAgentId,
    createdByUserId: issue.createdByUserId,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    checkoutHeartbeatRunId: issue.checkoutHeartbeatRunId,
    originKind: issue.originKind,
    originRef: issue.originRef,
    metadata: issue.metadata,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
}

function taskCommentFromIssueComment(comment: IssueComment): TaskComment {
  return {
    id: comment.id,
    taskId: comment.issueId,
    companyId: comment.companyId,
    authorUserId: comment.authorUserId,
    authorAgentId: comment.authorAgentId,
    body: comment.body,
    createdAt: comment.createdAt,
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

function mapAgentSession(row: typeof schema.agentSessions.$inferSelect): AgentSession {
  return {
    id: row.id,
    agentId: row.agentId,
    heartbeatRunId: row.heartbeatRunId,
    summary: row.summary,
    sessionState: row.sessionState,
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
    biller: row.biller,
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

  private async getSecretValue(companyId: string, name: string): Promise<string> {
    const [secret] = await this.db
      .select()
      .from(schema.secrets)
      .where(and(eq(schema.secrets.companyId, companyId), eq(schema.secrets.name, name)));

    if (!secret) {
      throw new Error(`secret_not_found:${name}`);
    }

    return secret.value;
  }

  async resolveSecretReferencesForCompany<T>(companyId: string, value: T): Promise<T> {
    if (typeof value === "string" && value.startsWith("secret://")) {
      return (await this.getSecretValue(companyId, value.slice("secret://".length))) as T;
    }

    if (isSecretReference(value)) {
      return (await this.getSecretValue(companyId, value.$secret)) as T;
    }

    if (Array.isArray(value)) {
      const resolved = await Promise.all(value.map((entry) => this.resolveSecretReferencesForCompany(companyId, entry)));
      return resolved as T;
    }

    if (value && typeof value === "object") {
      const entries = await Promise.all(
        Object.entries(value as Record<string, unknown>).map(async ([key, entry]) => [
          key,
          await this.resolveSecretReferencesForCompany(companyId, entry),
        ]),
      );
      return Object.fromEntries(entries) as T;
    }

    return value;
  }

  static create(connectionString: string, eventBus: DomainEventBus): PlatformService {
    return new PlatformService(createDatabase(connectionString), eventBus);
  }

  private async isBoardAlreadyClaimed(): Promise<boolean> {
    const [user] = await this.db.select({ id: schema.users.id }).from(schema.users).limit(1);
    return Boolean(user);
  }

  private async createBoardApiKeyRecord(userId: string, name: string): Promise<BoardApiKeyCreated> {
    const token = createOpaqueToken("board");
    const [row] = await this.db
      .insert(schema.boardApiKeys)
      .values({
        userId,
        name,
        keyHash: hashOpaqueToken(token),
      })
      .returning();

    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      token,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async createAgentApiKeyRecord(agentId: string, name: string): Promise<AgentApiKeyCreated> {
    const token = createOpaqueToken("agent");
    const [row] = await this.db
      .insert(schema.agentApiKeys)
      .values({
        agentId,
        name,
        keyHash: hashOpaqueToken(token),
      })
      .returning();

    return {
      id: row.id,
      agentId: row.agentId,
      name: row.name,
      token,
      createdAt: row.createdAt.toISOString(),
    };
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

  async authenticateBoardApiKey(token: string): Promise<AuthUser | null> {
    const keyHash = hashOpaqueToken(token);
    const [row] = await this.db
      .select({
        keyId: schema.boardApiKeys.id,
        user: schema.users,
      })
      .from(schema.boardApiKeys)
      .innerJoin(schema.users, eq(schema.users.id, schema.boardApiKeys.userId))
      .where(and(eq(schema.boardApiKeys.keyHash, keyHash), isNull(schema.boardApiKeys.revokedAt)));

    if (!row) {
      return null;
    }

    await this.db
      .update(schema.boardApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.boardApiKeys.id, row.keyId));

    return mapUser(row.user);
  }

  async authenticateAgentApiKey(token: string): Promise<Agent | null> {
    const keyHash = hashOpaqueToken(token);
    const [row] = await this.db
      .select({
        keyId: schema.agentApiKeys.id,
        agent: schema.agents,
      })
      .from(schema.agentApiKeys)
      .innerJoin(schema.agents, eq(schema.agents.id, schema.agentApiKeys.agentId))
      .where(and(eq(schema.agentApiKeys.keyHash, keyHash), isNull(schema.agentApiKeys.revokedAt)));

    if (!row) {
      return null;
    }

    await this.db
      .update(schema.agentApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(schema.agentApiKeys.id, row.keyId));

    return mapAgent(row.agent);
  }

  async createBoardClaimChallenge(ttlMinutes: number, force = false): Promise<BoardClaimChallenge> {
    if (!force && (await this.isBoardAlreadyClaimed())) {
      throw new Error("board_already_claimed");
    }

    const [row] = await this.db
      .insert(schema.boardClaimChallenges)
      .values({
        token: createOpaqueToken("claim"),
        code: createChallengeCode(),
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      })
      .returning();

    return mapBoardClaimChallenge(row);
  }

  async bootstrapChiefExecutiveOfficer(input: {
    token: string;
    code: string;
    email: string;
    name: string;
    password: string;
    company: {
      slug: string;
      name: string;
      description?: string;
      brandColor?: string;
      monthlyBudgetCents: number;
    };
  }): Promise<BootstrapCeoResult> {
    if (await this.isBoardAlreadyClaimed()) {
      throw new Error("board_already_claimed");
    }

    const [challenge] = await this.db
      .select()
      .from(schema.boardClaimChallenges)
      .where(eq(schema.boardClaimChallenges.token, input.token));

    if (!challenge || challenge.claimedAt || challenge.expiresAt < new Date() || challenge.code !== input.code) {
      throw new Error("invalid_board_claim");
    }

    const user = await this.registerUser({
      email: input.email,
      name: input.name,
      password: input.password,
    });

    const company = await this.createCompany(user.id, {
      slug: input.company.slug,
      name: input.company.name,
      description: input.company.description,
      brandColor: input.company.brandColor,
      monthlyBudgetCents: input.company.monthlyBudgetCents,
    });

    const membership = await this.getMembership(user.id, company.id);
    if (!membership) {
      throw new Error("membership_not_created");
    }

    const [claimed] = await this.db
      .update(schema.boardClaimChallenges)
      .set({
        claimedByUserId: user.id,
        claimedAt: new Date(),
      })
      .where(eq(schema.boardClaimChallenges.id, challenge.id))
      .returning();

    await this.recordActivity({
      companyId: company.id,
      actorUserId: user.id,
      kind: "board.claimed",
      targetType: "board_claim",
      targetId: claimed.id,
      summary: `Bootstrapped board owner ${user.email}`,
    });

    return {
      user,
      company,
      membership,
      boardClaim: mapBoardClaimChallenge(claimed),
    };
  }

  async createCliAuthChallenge(ttlMinutes: number, name?: string, requestedByUserId?: string | null): Promise<CliAuthChallengeStatus> {
    const [row] = await this.db
      .insert(schema.cliAuthChallenges)
      .values({
        challengeToken: createOpaqueToken("cli"),
        name: name?.trim() || null,
        requestedByUserId: requestedByUserId ?? null,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      })
      .returning();

    return {
      ...mapCliAuthChallenge(row),
      boardToken: null,
    };
  }

  async getCliAuthChallengeStatus(challengeId: string, challengeToken?: string): Promise<CliAuthChallengeStatus> {
    const [row] = await this.db
      .select()
      .from(schema.cliAuthChallenges)
      .where(eq(schema.cliAuthChallenges.id, challengeId));

    if (!row) {
      throw new Error("not_found");
    }

    let nextRow = row;
    const canConsumeApprovedToken =
      challengeToken &&
      row.challengeToken === challengeToken &&
      row.approvedToken &&
      !row.consumedAt &&
      row.expiresAt >= new Date();

    if (canConsumeApprovedToken) {
      const [updated] = await this.db
        .update(schema.cliAuthChallenges)
        .set({
          consumedAt: new Date(),
        })
        .where(eq(schema.cliAuthChallenges.id, row.id))
        .returning();

      if (updated) {
        nextRow = updated;
      }
    }

    const status = mapCliAuthChallenge(nextRow);
    return {
      ...status,
      boardToken: challengeToken && nextRow.challengeToken === challengeToken ? status.boardToken : null,
    };
  }

  async approveCliAuthChallenge(
    actorUserId: string,
    challengeId: string,
    challengeToken: string,
  ): Promise<CliAuthChallengeStatus> {
    const [challenge] = await this.db
      .select()
      .from(schema.cliAuthChallenges)
      .where(eq(schema.cliAuthChallenges.id, challengeId));

    if (!challenge) {
      throw new Error("not_found");
    }
    if (challenge.expiresAt < new Date() || challenge.challengeToken !== challengeToken) {
      throw new Error("invalid_cli_challenge");
    }

    const apiKey = await this.createBoardApiKeyRecord(actorUserId, challenge.name ? `CLI: ${challenge.name}` : "CLI session");

    const [row] = await this.db
      .update(schema.cliAuthChallenges)
      .set({
        approvedByUserId: actorUserId,
        boardApiKeyId: apiKey.id,
        approvedToken: apiKey.token,
        approvedAt: new Date(),
      })
      .where(eq(schema.cliAuthChallenges.id, challenge.id))
      .returning();

    const status = mapCliAuthChallenge(row);
    return status;
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

  async updateCompany(
    actorUserId: string,
    companyId: string,
    input: Partial<Pick<Company, "slug" | "name" | "description" | "status" | "brandColor" | "monthlyBudgetCents">>,
  ): Promise<Company> {
    const [existing] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!existing) {
      throw new Error("not_found");
    }

    await this.requirePermission(actorUserId, companyId, "company:update");

    const [company] = await this.db
      .update(schema.companies)
      .set({
        slug: input.slug ?? existing.slug,
        name: input.name ?? existing.name,
        description: input.description === undefined ? existing.description : input.description,
        status: input.status ?? (existing.status as Company["status"]),
        brandColor: input.brandColor === undefined ? existing.brandColor : input.brandColor,
        monthlyBudgetCents: input.monthlyBudgetCents ?? existing.monthlyBudgetCents,
        updatedAt: new Date(),
      })
      .where(eq(schema.companies.id, companyId))
      .returning();

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "company.updated",
      targetType: "company",
      targetId: company.id,
      summary: `Updated company ${company.name}`,
      payload: {
        slug: company.slug,
        status: company.status,
      },
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

  async listMemberships(actorUserId: string, companyId: string): Promise<Membership[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.companyId, companyId))
      .orderBy(asc(schema.memberships.createdAt));
    return rows.map(mapMembership);
  }

  async listCompanyMembers(actorUserId: string, companyId: string): Promise<CompanyMember[]> {
    const memberships = await this.listMemberships(actorUserId, companyId);
    if (memberships.length === 0) {
      return [];
    }

    const users = await this.db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
      })
      .from(schema.users)
      .where(
        inArray(
          schema.users.id,
          memberships.map((membership) => membership.userId),
        ),
      );

    const userById = new Map(users.map((user) => [user.id, user]));
    return memberships
      .map((membership) => {
        const user = userById.get(membership.userId);
        if (!user) {
          return null;
        }
        return mapCompanyMember(membership, user);
      })
      .filter((member): member is CompanyMember => Boolean(member));
  }

  async createInvite(
    actorUserId: string,
    companyId: string,
    input: {
      email: string;
      role: MembershipRole;
      onboardingTitle?: string;
      onboardingBody?: string;
      manifest?: Record<string, unknown>;
    },
  ) {
    await this.requirePermission(actorUserId, companyId, "membership:invite");
    const [invite] = await this.db
      .insert(schema.invites)
      .values({
        companyId,
        email: input.email,
        role: input.role,
        token: randomUUID(),
        invitedByUserId: actorUserId,
        onboardingTitle: input.onboardingTitle,
        onboardingBody: input.onboardingBody,
        manifest: input.manifest ?? {},
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

  async createHumanJoinRequest(
    actorUserId: string,
    companyId: string,
    input: {
      role?: MembershipRole;
      note?: string;
      onboardingTitle?: string;
      onboardingBody?: string;
      manifest?: Record<string, unknown>;
    },
  ): Promise<JoinRequest> {
    const [company] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!company) {
      throw new Error("not_found");
    }

    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, actorUserId));
    if (!user) {
      throw new Error("not_found");
    }

    const existingMembership = await this.getMembership(actorUserId, companyId);
    if (existingMembership) {
      throw new Error("already_member");
    }

    const [request] = await this.db
      .insert(schema.joinRequests)
      .values({
        companyId,
        kind: "human",
        status: "pending",
        requestedByUserId: actorUserId,
        email: user.email,
        role: input.role ?? "viewer",
        note: input.note,
        onboardingTitle: input.onboardingTitle,
        onboardingBody: input.onboardingBody,
        manifest: input.manifest ?? {},
        updatedAt: new Date(),
      })
      .returning();

    await this.recordActivity({
      companyId,
      actorUserId,
      kind: "join_request.created",
      targetType: "join_request",
      targetId: request.id,
      summary: `${user.email} requested to join ${company.name}`,
      payload: { kind: "human", requestedRole: request.role },
    });

    return mapJoinRequest(request);
  }

  async createAgentJoinRequest(
    companyId: string,
    input: {
      slug: string;
      name: string;
      title?: string;
      capabilities?: string;
      adapterType: Agent["adapterType"];
      adapterConfig?: Record<string, unknown>;
      runtimeConfig?: Record<string, unknown>;
      permissions?: string[];
      budgetMonthlyCents: number;
      note?: string;
      onboardingTitle?: string;
      onboardingBody?: string;
      manifest?: Record<string, unknown>;
    },
  ): Promise<JoinRequest> {
    const [company] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!company) {
      throw new Error("not_found");
    }

    const [request] = await this.db
      .insert(schema.joinRequests)
      .values({
        companyId,
        kind: "agent",
        status: "pending",
        note: input.note,
        onboardingTitle: input.onboardingTitle,
        onboardingBody: input.onboardingBody,
        manifest: input.manifest ?? {},
        agentDraft: {
          slug: input.slug,
          name: input.name,
          title: input.title ?? null,
          capabilities: input.capabilities ?? null,
          adapterType: input.adapterType,
          adapterConfig: input.adapterConfig ?? {},
          runtimeConfig: input.runtimeConfig ?? {},
          permissions: input.permissions ?? [],
          budgetMonthlyCents: input.budgetMonthlyCents,
        } satisfies JoinRequestAgentDraft,
        updatedAt: new Date(),
      })
      .returning();

    await this.recordActivity({
      companyId,
      kind: "join_request.created",
      targetType: "join_request",
      targetId: request.id,
      summary: `Agent candidate ${input.name} requested to join ${company.name}`,
      payload: { kind: "agent", adapterType: input.adapterType, slug: input.slug },
    });

    return mapJoinRequest(request);
  }

  async listJoinRequests(actorUserId: string, companyId: string): Promise<JoinRequest[]> {
    await this.requirePermission(actorUserId, companyId, "membership:update");
    const rows = await this.db
      .select()
      .from(schema.joinRequests)
      .where(eq(schema.joinRequests.companyId, companyId))
      .orderBy(desc(schema.joinRequests.createdAt));
    return rows.map(mapJoinRequest);
  }

  async resolveJoinRequest(
    actorUserId: string,
    joinRequestId: string,
    input: { status: "approved" | "rejected" | "cancelled"; role?: MembershipRole; resolutionNotes?: string },
  ): Promise<JoinRequestResolution> {
    const [existing] = await this.db.select().from(schema.joinRequests).where(eq(schema.joinRequests.id, joinRequestId));
    if (!existing) {
      throw new Error("not_found");
    }

    await this.requirePermission(actorUserId, existing.companyId, "membership:update");
    if (existing.status !== "pending") {
      throw new Error("join_request_already_resolved");
    }

    let membership: Membership | null = null;
    let agent: Agent | null = null;

    if (input.status === "approved" && existing.kind === "human") {
      if (!existing.requestedByUserId) {
        throw new Error("invalid_join_request");
      }
      const role = (input.role ?? existing.role ?? "viewer") as MembershipRole;
      const currentMembership = await this.getMembership(existing.requestedByUserId, existing.companyId);
      if (!currentMembership) {
        const [membershipRow] = await this.db
          .insert(schema.memberships)
          .values({
            companyId: existing.companyId,
            userId: existing.requestedByUserId,
            role,
          })
          .returning();
        membership = mapMembership(membershipRow);
        await this.recordActivity({
          companyId: existing.companyId,
          actorUserId,
          kind: "membership.created",
          targetType: "membership",
          targetId: membership.id,
          summary: `Approved human join request as ${role}`,
          payload: { joinRequestId, userId: existing.requestedByUserId },
        });
      } else {
        membership = currentMembership;
      }
    }

    if (input.status === "approved" && existing.kind === "agent") {
      const agentDraft = (existing.agentDraft as JoinRequestAgentDraft | null) ?? null;
      if (!agentDraft) {
        throw new Error("invalid_join_request");
      }
      await this.resolveSecretReferencesForCompany(existing.companyId, agentDraft.adapterConfig ?? {});
      await this.resolveSecretReferencesForCompany(existing.companyId, agentDraft.runtimeConfig ?? {});
      const [agentRow] = await this.db
        .insert(schema.agents)
        .values({
          companyId: existing.companyId,
          slug: agentDraft.slug,
          name: agentDraft.name,
          title: agentDraft.title,
          capabilities: agentDraft.capabilities,
          adapterType: agentDraft.adapterType,
          adapterConfig: agentDraft.adapterConfig ?? {},
          runtimeConfig: agentDraft.runtimeConfig ?? {},
          permissions: agentDraft.permissions ?? [],
          budgetMonthlyCents: agentDraft.budgetMonthlyCents,
          updatedAt: new Date(),
        })
        .returning();
      agent = mapAgent(agentRow);
      await this.recordActivity({
        companyId: existing.companyId,
        actorUserId,
        kind: "agent.created",
        targetType: "agent",
        targetId: agent.id,
        summary: `Approved agent join request for ${agent.name}`,
        payload: { joinRequestId, slug: agent.slug },
      });
    }

    const [resolved] = await this.db
      .update(schema.joinRequests)
      .set({
        status: input.status,
        role: input.role ?? existing.role,
        resolvedByUserId: actorUserId,
        resolvedAt: new Date(),
        resolutionNotes: input.resolutionNotes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.joinRequests.id, joinRequestId))
      .returning();

    await this.recordActivity({
      companyId: existing.companyId,
      actorUserId,
      kind: "join_request.resolved",
      targetType: "join_request",
      targetId: joinRequestId,
      summary: `Resolved ${existing.kind} join request as ${input.status}`,
      payload: { role: input.role ?? existing.role ?? null, resolutionNotes: input.resolutionNotes ?? null },
    });

    return {
      joinRequest: mapJoinRequest(resolved),
      membership,
      agent,
    };
  }

  async createGoal(
    actorUserId: string,
    companyId: string,
    input: {
      title: string;
      description?: string;
      level: Goal["level"];
      status: Goal["status"];
      parentId?: string | null;
      ownerAgentId?: string | null;
    },
  ) {
    await this.requirePermission(actorUserId, companyId, "goal:write");
    const [goal] = await this.db
      .insert(schema.goals)
      .values({
        companyId,
        title: input.title,
        description: input.description,
        level: input.level,
        status: input.status,
        parentId: input.parentId ?? null,
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
    const rows = await this.db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.companyId, companyId))
      .orderBy(asc(schema.goals.createdAt));
    return rows.map(mapGoal);
  }

  async updateGoal(
    actorUserId: string,
    goalId: string,
    input: Partial<Omit<Goal, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<Goal> {
    const [existing] = await this.db.select().from(schema.goals).where(eq(schema.goals.id, goalId));
    if (!existing) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, existing.companyId, "goal:write");
    const [goal] = await this.db
      .update(schema.goals)
      .set({
        title: input.title ?? existing.title,
        description: input.description ?? existing.description,
        level: input.level ?? (existing.level as Goal["level"]),
        status: input.status ?? (existing.status as Goal["status"]),
        parentId: input.parentId === undefined ? existing.parentId : input.parentId,
        ownerAgentId: input.ownerAgentId === undefined ? existing.ownerAgentId : input.ownerAgentId,
        updatedAt: new Date(),
      })
      .where(eq(schema.goals.id, goalId))
      .returning();
    await this.recordActivity({
      companyId: existing.companyId,
      actorUserId,
      kind: "goal.updated",
      targetType: "goal",
      targetId: goal.id,
      summary: `Updated goal ${goal.title}`,
    });
    return mapGoal(goal);
  }

  async createProject(
    actorUserId: string,
    companyId: string,
    input: {
      slug: string;
      name: string;
      description?: string;
      goalId?: string | null;
      status: Project["status"];
      targetDate?: string | null;
      color?: string | null;
      archivedAt?: string | null;
      ownerAgentId?: string | null;
    },
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
        status: input.status,
        targetDate: input.targetDate ?? null,
        color: input.color ?? null,
        archivedAt: input.archivedAt ? new Date(input.archivedAt) : null,
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
    const rows = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.companyId, companyId))
      .orderBy(asc(schema.projects.createdAt));
    return rows.map(mapProject);
  }

  async updateProject(
    actorUserId: string,
    projectId: string,
    input: Partial<Omit<Project, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<Project> {
    const [existing] = await this.db.select().from(schema.projects).where(eq(schema.projects.id, projectId));
    if (!existing) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, existing.companyId, "project:write");
    const [project] = await this.db
      .update(schema.projects)
      .set({
        goalId: input.goalId === undefined ? existing.goalId : input.goalId,
        slug: input.slug ?? existing.slug,
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        status: input.status ?? (existing.status as Project["status"]),
        targetDate: input.targetDate === undefined ? existing.targetDate : input.targetDate,
        color: input.color === undefined ? existing.color : input.color,
        archivedAt: input.archivedAt === undefined ? existing.archivedAt : input.archivedAt ? new Date(input.archivedAt) : null,
        ownerAgentId: input.ownerAgentId === undefined ? existing.ownerAgentId : input.ownerAgentId,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning();
    await this.recordActivity({
      companyId: existing.companyId,
      actorUserId,
      kind: "project.updated",
      targetType: "project",
      targetId: project.id,
      summary: `Updated project ${project.name}`,
    });
    return mapProject(project);
  }

  async createProjectWorkspace(
    actorUserId: string,
    companyId: string,
    projectId: string,
    input: {
      name: string;
      cwd?: string | null;
      repoUrl?: string | null;
      repoRef?: string | null;
      isPrimary: boolean;
    },
  ): Promise<ProjectWorkspace> {
    await this.requirePermission(actorUserId, companyId, "project:write");

    if (input.isPrimary) {
      await this.db
        .update(schema.projectWorkspaces)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(and(eq(schema.projectWorkspaces.companyId, companyId), eq(schema.projectWorkspaces.projectId, projectId)));
    }

    const [row] = await this.db
      .insert(schema.projectWorkspaces)
      .values({
        companyId,
        projectId,
        name: input.name,
        cwd: input.cwd ?? null,
        repoUrl: input.repoUrl ?? null,
        repoRef: input.repoRef ?? null,
        isPrimary: input.isPrimary,
        updatedAt: new Date(),
      })
      .returning();

    return mapProjectWorkspace(row);
  }

  async listProjectWorkspaces(actorUserId: string, companyId: string, projectId: string): Promise<ProjectWorkspace[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.projectWorkspaces)
      .where(and(eq(schema.projectWorkspaces.companyId, companyId), eq(schema.projectWorkspaces.projectId, projectId)))
      .orderBy(desc(schema.projectWorkspaces.isPrimary), asc(schema.projectWorkspaces.createdAt));
    return rows.map(mapProjectWorkspace);
  }

  async createExecutionWorkspace(
    actorUserId: string,
    companyId: string,
    input: {
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
  ): Promise<ExecutionWorkspace> {
    await this.requirePermission(actorUserId, companyId, "project:write");
    const [row] = await this.db
      .insert(schema.executionWorkspaces)
      .values({
        companyId,
        projectId: input.projectId ?? null,
        issueId: input.issueId ?? null,
        name: input.name,
        cwd: input.cwd ?? null,
        repoUrl: input.repoUrl ?? null,
        baseRef: input.baseRef ?? null,
        branchName: input.branchName ?? null,
        mode: input.mode,
        status: input.status,
        updatedAt: new Date(),
      })
      .returning();
    return mapExecutionWorkspace(row);
  }

  async listExecutionWorkspaces(
    actorUserId: string,
    companyId: string,
    filters: { projectId?: string | null; issueId?: string | null } = {},
  ): Promise<ExecutionWorkspace[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.executionWorkspaces)
      .where(
        and(
          eq(schema.executionWorkspaces.companyId, companyId),
          filters.projectId ? eq(schema.executionWorkspaces.projectId, filters.projectId) : undefined,
          filters.issueId ? eq(schema.executionWorkspaces.issueId, filters.issueId) : undefined,
        ),
      )
      .orderBy(desc(schema.executionWorkspaces.createdAt));
    return rows.map(mapExecutionWorkspace);
  }

  async createCompanySkill(
    actorUserId: string,
    companyId: string,
    input: {
      slug: string;
      name: string;
      description?: string | null;
      markdown: string;
      sourceType: CompanySkill["sourceType"];
      sourceLocator?: string | null;
    },
  ): Promise<CompanySkill> {
    await this.requirePermission(actorUserId, companyId, "package:import");
    const [row] = await this.db
      .insert(schema.companySkills)
      .values({
        companyId,
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        markdown: input.markdown,
        sourceType: input.sourceType,
        sourceLocator: input.sourceLocator ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return mapCompanySkill(row);
  }

  async updateCompanySkill(
    actorUserId: string,
    skillId: string,
    input: Partial<Omit<CompanySkill, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<CompanySkill> {
    const [skill] = await this.db.select().from(schema.companySkills).where(eq(schema.companySkills.id, skillId));
    if (!skill) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, skill.companyId, "package:import");
    const [row] = await this.db
      .update(schema.companySkills)
      .set({
        slug: input.slug ?? skill.slug,
        name: input.name ?? skill.name,
        description: input.description === undefined ? skill.description : input.description,
        markdown: input.markdown ?? skill.markdown,
        sourceType: input.sourceType ?? (skill.sourceType as CompanySkill["sourceType"]),
        sourceLocator: input.sourceLocator === undefined ? skill.sourceLocator : input.sourceLocator,
        updatedAt: new Date(),
      })
      .where(eq(schema.companySkills.id, skillId))
      .returning();
    return mapCompanySkill(row);
  }

  async listCompanySkills(actorUserId: string, companyId: string): Promise<CompanySkill[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.companySkills)
      .where(eq(schema.companySkills.companyId, companyId))
      .orderBy(asc(schema.companySkills.slug));
    return rows.map(mapCompanySkill);
  }

  async scanCompanySkills(actorUserId: string, companyId: string, root: string, upsert = true): Promise<CompanySkill[]> {
    await this.requirePermission(actorUserId, companyId, "package:import");
    const files = await collectSkillFiles(root);
    const collected: CompanySkill[] = [];

    for (const filePath of files) {
      const markdown = await readFile(filePath, "utf8");
      const slug = path.basename(path.dirname(filePath)).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      const name = path.basename(path.dirname(filePath));

      const [existing] = await this.db
        .select()
        .from(schema.companySkills)
        .where(and(eq(schema.companySkills.companyId, companyId), eq(schema.companySkills.slug, slug)));

      if (existing && upsert) {
        const [updated] = await this.db
          .update(schema.companySkills)
          .set({
            name,
            markdown,
            sourceType: "local_path",
            sourceLocator: filePath,
            updatedAt: new Date(),
          })
          .where(eq(schema.companySkills.id, existing.id))
          .returning();
        collected.push(mapCompanySkill(updated));
        continue;
      }

      if (!existing) {
        const [created] = await this.db
          .insert(schema.companySkills)
          .values({
            companyId,
            slug,
            name,
            markdown,
            sourceType: "local_path",
            sourceLocator: filePath,
            updatedAt: new Date(),
          })
          .returning();
        collected.push(mapCompanySkill(created));
      }
    }

    return collected;
  }

  async createSecret(
    actorUserId: string,
    companyId: string,
    input: { name: string; value: string; valueHint?: string | null },
  ): Promise<Secret> {
    await this.requirePermission(actorUserId, companyId, "company:update");
    const [row] = await this.db
      .insert(schema.secrets)
      .values({
        companyId,
        name: input.name,
        value: input.value,
        valueHint: input.valueHint ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return mapSecret(row);
  }

  async updateSecret(
    actorUserId: string,
    secretId: string,
    input: { value?: string; valueHint?: string | null },
  ): Promise<Secret> {
    const [secret] = await this.db.select().from(schema.secrets).where(eq(schema.secrets.id, secretId));
    if (!secret) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, secret.companyId, "company:update");
    const [row] = await this.db
      .update(schema.secrets)
      .set({
        value: input.value ?? secret.value,
        valueHint: input.valueHint === undefined ? secret.valueHint : input.valueHint,
        updatedAt: new Date(),
      })
      .where(eq(schema.secrets.id, secretId))
      .returning();
    return mapSecret(row);
  }

  async listSecrets(actorUserId: string, companyId: string): Promise<Secret[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db.select().from(schema.secrets).where(eq(schema.secrets.companyId, companyId));
    return rows.map(mapSecret);
  }

  async createIssue(
    actorUserId: string,
    companyId: string,
    input: {
      projectId?: string | null;
      goalId?: string | null;
      parentId?: string | null;
      assigneeAgentId?: string | null;
      title: string;
      description?: string;
      status: Issue["status"];
      priority: Issue["priority"];
      originKind: string;
      originRef?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Issue> {
    await this.requirePermission(actorUserId, companyId, "issue:write");
    const [issue] = await this.db
      .insert(schema.tasks)
      .values({
        companyId,
        projectId: input.projectId ?? null,
        goalId: input.goalId ?? null,
        parentTaskId: input.parentId ?? null,
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
      kind: "issue.created",
      targetType: "issue",
      targetId: issue.id,
      summary: `Created issue ${issue.title}`,
    });
    return mapIssue(issue);
  }

  async listIssues(actorUserId: string, companyId: string): Promise<Issue[]> {
    await this.requirePermission(actorUserId, companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.companyId, companyId))
      .orderBy(desc(schema.tasks.createdAt));
    return rows.map(mapIssue);
  }

  async getIssue(issueId: string): Promise<Issue | null> {
    const [row] = await this.db.select().from(schema.tasks).where(eq(schema.tasks.id, issueId));
    return row ? mapIssue(row) : null;
  }

  async getIssueForActor(actorUserId: string, issueId: string): Promise<Issue> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    return issue;
  }

  async updateIssue(
    actorUserId: string,
    issueId: string,
    input: Partial<Omit<Issue, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<Issue> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");
    const [row] = await this.db
      .update(schema.tasks)
      .set({
        projectId: input.projectId === undefined ? issue.projectId : input.projectId,
        goalId: input.goalId === undefined ? issue.goalId : input.goalId,
        parentTaskId: input.parentId === undefined ? issue.parentId : input.parentId,
        assigneeAgentId: input.assigneeAgentId === undefined ? issue.assigneeAgentId : input.assigneeAgentId,
        title: input.title ?? issue.title,
        description: input.description ?? issue.description,
        status: input.status ?? issue.status,
        priority: input.priority ?? issue.priority,
        originKind: input.originKind ?? issue.originKind,
        originRef: input.originRef === undefined ? issue.originRef : input.originRef,
        metadata: input.metadata ?? issue.metadata,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, issueId))
      .returning();
    await this.recordActivity({
      companyId: issue.companyId,
      actorUserId,
      kind: "issue.updated",
      targetType: "issue",
      targetId: issueId,
      summary: `Updated issue ${row.title}`,
    });
    return mapIssue(row);
  }

  async checkoutIssue(actorUserId: string, issueId: string, agentId: string, heartbeatRunId?: string) {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:checkout");
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
          eq(schema.tasks.id, issueId),
          inArray(schema.tasks.status, ["backlog", "todo", "blocked"]),
        ),
      )
      .returning();
    if (!row) {
      throw new Error("issue_checkout_conflict");
    }
    await this.recordActivity({
      companyId: issue.companyId,
      actorUserId,
      kind: "issue.checked_out",
      targetType: "issue",
      targetId: issueId,
      summary: `Checked out issue ${row.title}`,
      payload: { agentId, heartbeatRunId },
    });
    return mapIssue(row);
  }

  async addIssueComment(actorUserId: string, issueId: string, body: string) {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");
    const [row] = await this.db
      .insert(schema.taskComments)
      .values({
        companyId: issue.companyId,
        taskId: issueId,
        authorUserId: actorUserId,
        body,
      })
      .returning();
    await this.recordActivity({
      companyId: issue.companyId,
      actorUserId,
      kind: "issue.commented",
      targetType: "issue_comment",
      targetId: row.id,
      summary: `Commented on issue ${issue.title}`,
    });
    return mapIssueComment(row);
  }

  async listIssueComments(actorUserId: string, issueId: string): Promise<IssueComment[]> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.taskComments)
      .where(eq(schema.taskComments.taskId, issueId))
      .orderBy(asc(schema.taskComments.createdAt));
    return rows.map(mapIssueComment);
  }

  async createIssueDocument(
    actorUserId: string,
    issueId: string,
    input: { key: string; title: string; format: IssueDocument["format"]; body: string },
  ): Promise<IssueDocument> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");

    const [document] = await this.db
      .insert(schema.issueDocuments)
      .values({
        issueId,
        key: input.key,
        title: input.title,
        format: input.format,
        body: input.body,
        updatedAt: new Date(),
      })
      .returning();

    const [revision] = await this.db
      .insert(schema.issueDocumentRevisions)
      .values({
        documentId: document.id,
        body: input.body,
        createdByUserId: actorUserId,
      })
      .returning();

    await this.db
      .update(schema.issueDocuments)
      .set({ latestRevisionId: revision.id, updatedAt: new Date() })
      .where(eq(schema.issueDocuments.id, document.id));

    return {
      ...mapIssueDocument(document),
      latestRevisionId: revision.id,
    };
  }

  async updateIssueDocument(
    actorUserId: string,
    documentId: string,
    input: { title?: string; format?: IssueDocument["format"]; body?: string },
  ): Promise<IssueDocument> {
    const [document] = await this.db.select().from(schema.issueDocuments).where(eq(schema.issueDocuments.id, documentId));
    if (!document) {
      throw new Error("not_found");
    }
    const issue = await this.getIssue(document.issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");

    let latestRevisionId = document.latestRevisionId;
    if (input.body !== undefined && input.body !== document.body) {
      const [revision] = await this.db
        .insert(schema.issueDocumentRevisions)
        .values({
          documentId: document.id,
          body: input.body,
          createdByUserId: actorUserId,
        })
        .returning();
      latestRevisionId = revision.id;
    }

    const [row] = await this.db
      .update(schema.issueDocuments)
      .set({
        title: input.title ?? document.title,
        format: input.format ?? (document.format as IssueDocument["format"]),
        body: input.body ?? document.body,
        latestRevisionId,
        updatedAt: new Date(),
      })
      .where(eq(schema.issueDocuments.id, documentId))
      .returning();

    return mapIssueDocument(row);
  }

  async listIssueDocuments(actorUserId: string, issueId: string): Promise<IssueDocumentSummary[]> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.issueDocuments)
      .where(eq(schema.issueDocuments.issueId, issueId))
      .orderBy(asc(schema.issueDocuments.key));
    return rows.map(mapIssueDocumentSummary);
  }

  async listIssueDocumentRevisions(actorUserId: string, documentId: string): Promise<IssueDocumentRevision[]> {
    const [document] = await this.db.select().from(schema.issueDocuments).where(eq(schema.issueDocuments.id, documentId));
    if (!document) {
      throw new Error("not_found");
    }
    const issue = await this.getIssue(document.issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.issueDocumentRevisions)
      .where(eq(schema.issueDocumentRevisions.documentId, documentId))
      .orderBy(desc(schema.issueDocumentRevisions.createdAt));
    return rows.map(mapIssueDocumentRevision);
  }

  async createIssueAttachment(
    actorUserId: string,
    issueId: string,
    input: { name: string; contentType: string; sizeBytes: number; url?: string | null; metadata: Record<string, unknown> },
  ): Promise<IssueAttachment> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");
    const [row] = await this.db
      .insert(schema.issueAttachments)
      .values({
        companyId: issue.companyId,
        issueId,
        name: input.name,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        url: input.url ?? null,
        metadata: input.metadata,
      })
      .returning();
    return mapIssueAttachment(row);
  }

  async listIssueAttachments(actorUserId: string, issueId: string): Promise<IssueAttachment[]> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.issueAttachments)
      .where(eq(schema.issueAttachments.issueId, issueId))
      .orderBy(desc(schema.issueAttachments.createdAt));
    return rows.map(mapIssueAttachment);
  }

  async createIssueWorkProduct(
    actorUserId: string,
    issueId: string,
    input: { kind: string; title: string; content: Record<string, unknown> },
  ): Promise<IssueWorkProduct> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "issue:write");
    const [row] = await this.db
      .insert(schema.issueWorkProducts)
      .values({
        issueId,
        kind: input.kind,
        title: input.title,
        content: input.content,
        updatedAt: new Date(),
      })
      .returning();
    return mapIssueWorkProduct(row);
  }

  async listIssueWorkProducts(actorUserId: string, issueId: string): Promise<IssueWorkProduct[]> {
    const issue = await this.getIssue(issueId);
    if (!issue) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, issue.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.issueWorkProducts)
      .where(eq(schema.issueWorkProducts.issueId, issueId))
      .orderBy(desc(schema.issueWorkProducts.createdAt));
    return rows.map(mapIssueWorkProduct);
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
    await this.resolveSecretReferencesForCompany(companyId, input.adapterConfig ?? {});
    await this.resolveSecretReferencesForCompany(companyId, input.runtimeConfig ?? {});
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

  async getOrgTree(actorUserId: string, companyId: string) {
    const agents = await this.listAgents(actorUserId, companyId);
    const [company] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!company) {
      throw new Error("not_found");
    }

    const nodes = new Map(
      agents.map((agent) => [
        agent.id,
        {
          id: agent.id,
          name: agent.name,
          title: agent.title,
          status: agent.status,
          children: [] as Array<Record<string, unknown>>,
        },
      ]),
    );

    const roots: Array<Record<string, unknown>> = [];
    for (const agent of agents) {
      const node = nodes.get(agent.id)!;
      if (agent.parentAgentId && nodes.has(agent.parentAgentId)) {
        nodes.get(agent.parentAgentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      agents: roots,
    };
  }

  async getOrgChartSvg(actorUserId: string, companyId: string): Promise<string> {
    const tree = await this.getOrgTree(actorUserId, companyId);
    const flat: Array<{ name: string; title: string | null; status: string }> = [];
    const visit = (nodes: Array<{ name: string; title: string | null; status: string; children: unknown[] }>) => {
      for (const node of nodes) {
        flat.push({ name: node.name, title: node.title, status: node.status });
        visit(node.children as Array<{ name: string; title: string | null; status: string; children: unknown[] }>);
      }
    };
    visit(tree.agents as Array<{ name: string; title: string | null; status: string; children: unknown[] }>);

    const width = 960;
    const rowHeight = 90;
    const height = Math.max(220, flat.length * rowHeight + 120);
    const cards = flat
      .map((node, index) => {
        const x = 80 + ((index % 3) * 280);
        const y = 80 + Math.floor(index / 3) * rowHeight;
        return [
          `<rect x="${x}" y="${y}" width="220" height="56" rx="18" fill="#101826" stroke="#273244" />`,
          `<text x="${x + 18}" y="${y + 24}" fill="#f8fafc" font-size="16" font-family="IBM Plex Sans, sans-serif">${node.name}</text>`,
          `<text x="${x + 18}" y="${y + 42}" fill="#94a3b8" font-size="12" font-family="IBM Plex Sans, sans-serif">${node.title ?? node.status}</text>`,
        ].join("");
      })
      .join("");

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<rect width="100%" height="100%" fill="#060816" />`,
      `<text x="60" y="44" fill="#e2e8f0" font-size="28" font-family="IBM Plex Sans, sans-serif">${tree.company.name} Org Chart</text>`,
      cards,
      `</svg>`,
    ].join("");
  }

  async getOrgChartPng(actorUserId: string, companyId: string): Promise<Uint8Array> {
    const svg = await this.getOrgChartSvg(actorUserId, companyId);
    const image = new Resvg(svg, {
      fitTo: {
        mode: "width",
        value: 1440,
      },
    }).render();
    return image.asPng();
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    const [row] = await this.db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
    return row ? mapAgent(row) : null;
  }

  async getAgentForActor(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "audit:read");
    return agent;
  }

  async getAgentRuntimeState(actorUserId: string, agentId: string): Promise<AgentRuntimeState> {
    const agent = await this.getAgentForActor(actorUserId, agentId);
    const [heartbeat] = await this.db
      .select()
      .from(schema.heartbeatRuns)
      .where(eq(schema.heartbeatRuns.agentId, agentId))
      .orderBy(desc(schema.heartbeatRuns.createdAt))
      .limit(1);

    return {
      agentId: agent.id,
      status: agent.status,
      sessionState: agent.sessionState,
      lastHeartbeatAt: agent.lastHeartbeatAt,
      lastHeartbeatRunId: heartbeat?.id ?? null,
      lastHeartbeatStatus: heartbeat ? (heartbeat.status as HeartbeatRun["status"]) : null,
      updatedAt: agent.updatedAt,
    };
  }

  async listAgentSessions(actorUserId: string, agentId: string): Promise<AgentSession[]> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "audit:read");
    const rows = await this.db
      .select()
      .from(schema.agentSessions)
      .where(eq(schema.agentSessions.agentId, agentId))
      .orderBy(desc(schema.agentSessions.updatedAt));
    return rows.map(mapAgentSession);
  }

  async pauseAgent(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    const [row] = await this.db
      .update(schema.agents)
      .set({
        status: "paused",
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId))
      .returning();
    await this.recordActivity({
      companyId: agent.companyId,
      actorUserId,
      kind: "agent.paused",
      targetType: "agent",
      targetId: agentId,
      summary: `Paused agent ${agent.name}`,
    });
    return mapAgent(row);
  }

  async resumeAgent(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    const [row] = await this.db
      .update(schema.agents)
      .set({
        status: "idle",
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId))
      .returning();
    await this.recordActivity({
      companyId: agent.companyId,
      actorUserId,
      kind: "agent.resumed",
      targetType: "agent",
      targetId: agentId,
      summary: `Resumed agent ${agent.name}`,
    });
    return mapAgent(row);
  }

  async terminateAgent(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    const [row] = await this.db
      .update(schema.agents)
      .set({
        status: "terminated",
        sessionState: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.agents.id, agentId))
      .returning();
    await this.recordActivity({
      companyId: agent.companyId,
      actorUserId,
      kind: "agent.terminated",
      targetType: "agent",
      targetId: agentId,
      summary: `Terminated agent ${agent.name}`,
    });
    return mapAgent(row);
  }

  async createAgentApiKey(actorUserId: string, agentId: string, name: string): Promise<AgentApiKeyCreated> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    const apiKey = await this.createAgentApiKeyRecord(agentId, name);
    await this.recordActivity({
      companyId: agent.companyId,
      actorUserId,
      kind: "agent.api_key_created",
      targetType: "agent_api_key",
      targetId: apiKey.id,
      summary: `Created API key ${name} for ${agent.name}`,
    });
    return apiKey;
  }

  async prepareAgentAccess(actorUserId: string, agentId: string): Promise<Agent> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, agent.companyId, "agent:write");
    return agent;
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

  async recordAgentSession(
    agentId: string,
    heartbeatRunId: string | null,
    sessionState: Record<string, unknown> | null,
    summary?: string | null,
  ): Promise<AgentSession> {
    const [row] = await this.db
      .insert(schema.agentSessions)
      .values({
        agentId,
        heartbeatRunId,
        summary: summary ?? null,
        sessionState,
        updatedAt: new Date(),
      })
      .returning();
    return mapAgentSession(row);
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
    const issue = await this.createIssue(actorUserId, companyId, {
      projectId: input.projectId,
      goalId: input.goalId,
      parentId: input.parentTaskId,
      assigneeAgentId: input.assigneeAgentId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      originKind: input.originKind,
      originRef: input.originRef,
      metadata: input.metadata,
    });
    return taskFromIssue(issue);
  }

  async listTasks(actorUserId: string, companyId: string): Promise<Task[]> {
    const issues = await this.listIssues(actorUserId, companyId);
    return issues.map(taskFromIssue);
  }

  async getTask(taskId: string): Promise<Task | null> {
    const issue = await this.getIssue(taskId);
    return issue ? taskFromIssue(issue) : null;
  }

  async getTaskForActor(actorUserId: string, taskId: string): Promise<Task> {
    const task = await this.getTask(taskId);
    if (!task) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, task.companyId, "audit:read");
    return task;
  }

  async updateTask(actorUserId: string, taskId: string, input: Partial<Omit<Task, "id" | "companyId" | "createdAt" | "updatedAt">>) {
    const issue = await this.updateIssue(actorUserId, taskId, {
      projectId: input.projectId,
      goalId: input.goalId,
      parentId: input.parentTaskId,
      assigneeAgentId: input.assigneeAgentId,
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      originKind: input.originKind,
      originRef: input.originRef,
      metadata: input.metadata,
    });
    return taskFromIssue(issue);
  }

  async checkoutTask(actorUserId: string, taskId: string, agentId: string, heartbeatRunId?: string) {
    const issue = await this.checkoutIssue(actorUserId, taskId, agentId, heartbeatRunId);
    return taskFromIssue(issue);
  }

  async addTaskComment(actorUserId: string, taskId: string, body: string) {
    const comment = await this.addIssueComment(actorUserId, taskId, body);
    return taskCommentFromIssueComment(comment);
  }

  async listTaskComments(actorUserId: string, taskId: string): Promise<TaskComment[]> {
    const comments = await this.listIssueComments(actorUserId, taskId);
    return comments.map(taskCommentFromIssueComment);
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
        biller: input.biller,
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

  async getCostOverview(actorUserId: string, companyId: string): Promise<CompanyCostOverview> {
    await this.requirePermission(actorUserId, companyId, "cost:read");
    const [companyRow] = await this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId));
    if (!companyRow) {
      throw new Error("not_found");
    }

    const costs = await this.db.select().from(schema.costEvents).where(eq(schema.costEvents.companyId, companyId));
    const heartbeats = await this.db
      .select()
      .from(schema.heartbeatRuns)
      .where(eq(schema.heartbeatRuns.companyId, companyId));
    const tasks = await this.db.select().from(schema.tasks).where(eq(schema.tasks.companyId, companyId));

    const heartbeatById = new Map(heartbeats.map((heartbeat) => [heartbeat.id, heartbeat]));
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    const summary: CostSummary = {
      monthSpendCents: costs.reduce((sum, cost) => sum + cost.amountCents, 0),
      companyBudgetCents: companyRow.monthlyBudgetCents,
      utilizationRatio:
        companyRow.monthlyBudgetCents > 0
          ? costs.reduce((sum, cost) => sum + cost.amountCents, 0) / companyRow.monthlyBudgetCents
          : 0,
    };

    const byAgent = new Map<string, number>();
    const byProject = new Map<string | null, number>();
    const byProvider = new Map<string, number>();
    const byBiller = new Map<string, number>();

    for (const cost of costs) {
      if (cost.agentId) {
        byAgent.set(cost.agentId, (byAgent.get(cost.agentId) ?? 0) + cost.amountCents);
      }

      const heartbeat = cost.heartbeatRunId ? heartbeatById.get(cost.heartbeatRunId) : undefined;
      const task = heartbeat?.taskId ? taskById.get(heartbeat.taskId) : undefined;
      const projectId = task?.projectId ?? null;
      byProject.set(projectId, (byProject.get(projectId) ?? 0) + cost.amountCents);
      byProvider.set(cost.provider, (byProvider.get(cost.provider) ?? 0) + cost.amountCents);
      byBiller.set(cost.biller, (byBiller.get(cost.biller) ?? 0) + cost.amountCents);
    }

    return {
      summary,
      byAgent: Array.from(byAgent, ([agentId, amountCents]) => ({ agentId, amountCents } satisfies CostSummaryByAgent)),
      byProject: Array.from(byProject, ([projectId, amountCents]) => ({ projectId, amountCents } satisfies CostSummaryByProject)),
      byProvider: Array.from(byProvider, ([provider, amountCents]) => ({ provider, amountCents } satisfies CostSummaryByProvider)),
      byBiller: Array.from(byBiller, ([biller, amountCents]) => ({ biller, amountCents } satisfies CostSummaryByBiller)),
    };
  }

  async listFinanceEvents(actorUserId: string, companyId: string): Promise<FinanceEvent[]> {
    await this.requirePermission(actorUserId, companyId, "cost:read");

    const [costs, heartbeats, tasks] = await Promise.all([
      this.db.select().from(schema.costEvents).where(eq(schema.costEvents.companyId, companyId)).orderBy(desc(schema.costEvents.createdAt)),
      this.db.select().from(schema.heartbeatRuns).where(eq(schema.heartbeatRuns.companyId, companyId)),
      this.db.select().from(schema.tasks).where(eq(schema.tasks.companyId, companyId)),
    ]);

    const heartbeatById = new Map(heartbeats.map((heartbeat) => [heartbeat.id, heartbeat]));
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    return costs.map((cost) => {
      const heartbeat = cost.heartbeatRunId ? heartbeatById.get(cost.heartbeatRunId) : undefined;
      const task = heartbeat?.taskId ? taskById.get(heartbeat.taskId) : undefined;
      return {
        id: cost.id,
        companyId: cost.companyId,
        agentId: cost.agentId,
        heartbeatRunId: cost.heartbeatRunId,
        projectId: task?.projectId ?? null,
        amountCents: cost.amountCents,
        currency: cost.currency,
        biller: cost.biller,
        provider: cost.provider,
        model: cost.model,
        direction: cost.direction as FinanceEvent["direction"],
        category: cost.direction === "credit" ? "credit" : "usage_cost",
        metadata: {
          taskId: task?.id ?? null,
          issueId: task?.id ?? null,
          heartbeatStatus: heartbeat?.status ?? null,
        },
        createdAt: cost.createdAt.toISOString(),
      } satisfies FinanceEvent;
    });
  }

  async listQuotaWindows(actorUserId: string, companyId: string): Promise<QuotaWindow[]> {
    await this.requirePermission(actorUserId, companyId, "cost:read");

    const [companyRow, budgets, agents, costs] = await Promise.all([
      this.db.select().from(schema.companies).where(eq(schema.companies.id, companyId)),
      this.db.select().from(schema.budgetPolicies).where(eq(schema.budgetPolicies.companyId, companyId)),
      this.db.select().from(schema.agents).where(eq(schema.agents.companyId, companyId)),
      this.db.select().from(schema.costEvents).where(eq(schema.costEvents.companyId, companyId)),
    ]);

    if (!companyRow[0]) {
      throw new Error("not_found");
    }

    const company = companyRow[0];
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const periodCosts = costs.filter((cost) => cost.createdAt >= periodStart && cost.createdAt < periodEnd);
    const signedCost = (amountCents: number, direction: "debit" | "credit") => (direction === "credit" ? -amountCents : amountCents);
    const companySpend = periodCosts.reduce(
      (sum, cost) => sum + signedCost(cost.amountCents, cost.direction as FinanceEvent["direction"]),
      0,
    );
    const spendByAgent = new Map<string, number>();
    for (const cost of periodCosts) {
      if (!cost.agentId) {
        continue;
      }
      spendByAgent.set(
        cost.agentId,
        (spendByAgent.get(cost.agentId) ?? 0) + signedCost(cost.amountCents, cost.direction as FinanceEvent["direction"]),
      );
    }

    const windows: QuotaWindow[] = [];
    const companyBudget = budgets.find((budget) => budget.scope === "company" && budget.agentId === null);
    const companyLimit = companyBudget?.monthlyLimitCents ?? company.monthlyBudgetCents;
    const companyRemaining = companyLimit - companySpend;
    const companyRatio = companyLimit > 0 ? companySpend / companyLimit : 0;
    windows.push({
      id: `company:${company.id}:${periodStart.toISOString()}`,
      companyId,
      scope: "company",
      scopeRef: null,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      limitCents: companyLimit,
      spentCents: companySpend,
      remainingCents: companyRemaining,
      hardStop: companyBudget?.hardStop ?? true,
      status: companyRemaining < 0 ? "exceeded" : companyRatio >= 0.8 ? "warning" : "ok",
    });

    for (const agent of agents) {
      const budget = budgets.find((entry) => entry.scope === "agent" && entry.agentId === agent.id);
      const limit = budget?.monthlyLimitCents ?? agent.budgetMonthlyCents;
      const spent = spendByAgent.get(agent.id) ?? 0;
      if (!limit && !spent) {
        continue;
      }
      const remaining = limit - spent;
      const ratio = limit > 0 ? spent / limit : 0;
      windows.push({
        id: `agent:${agent.id}:${periodStart.toISOString()}`,
        companyId,
        scope: "agent",
        scopeRef: agent.id,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        limitCents: limit,
        spentCents: spent,
        remainingCents: remaining,
        hardStop: budget?.hardStop ?? true,
        status: remaining < 0 ? "exceeded" : ratio >= 0.8 ? "warning" : "ok",
      });
    }

    return windows;
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
    await this.resolveSecretReferencesForCompany(companyId, input.config);
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

  async setPluginStatus(actorUserId: string, pluginId: string, status: "active" | "disabled"): Promise<Plugin> {
    const [plugin] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!plugin) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, plugin.companyId, "plugin:write");
    const [row] = await this.db
      .update(schema.plugins)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.plugins.id, pluginId))
      .returning();
    return mapPlugin(row);
  }

  async upgradePlugin(
    actorUserId: string,
    pluginId: string,
    input: { manifest: Record<string, unknown>; config: Record<string, unknown> },
  ): Promise<Plugin> {
    const [plugin] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!plugin) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, plugin.companyId, "plugin:write");
    const manifest = validatePluginManifest(input.manifest);
    await this.resolveSecretReferencesForCompany(plugin.companyId, input.config);
    const [row] = await this.db
      .update(schema.plugins)
      .set({
        manifest: manifest as unknown as Record<string, unknown>,
        config: input.config,
        updatedAt: new Date(),
      })
      .where(eq(schema.plugins.id, pluginId))
      .returning();
    return mapPlugin(row);
  }

  async getPluginHealth(actorUserId: string, pluginId: string): Promise<PluginHealth> {
    const [plugin] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!plugin) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, plugin.companyId, "audit:read");
    const manifest = plugin.manifest as unknown as Plugin["manifest"];
    const mappedPlugin = mapPlugin(plugin);
    const resolvedConfig = await this.resolveSecretReferencesForCompany(plugin.companyId, mappedPlugin.config);

    const runtime = plugin.status === "disabled"
      ? {
          ok: false,
          result: { message: "Plugin is disabled." },
        }
      : await executePluginRuntime(mappedPlugin, resolvedConfig, "health", undefined, {});

    return {
      pluginId: plugin.id,
      status: plugin.status === "disabled" ? "disabled" : runtime.ok ? "healthy" : "degraded",
      message:
        plugin.status === "disabled"
          ? "Plugin is disabled."
          : runtime.ok
            ? `Plugin ${plugin.name} is healthy and exposes ${manifest.capabilities.length} capabilities.`
            : String(
                (runtime.result as { message?: unknown }).message ?? `Plugin ${plugin.name} runtime check failed.`,
              ),
      checkedAt: new Date().toISOString(),
      capabilities: manifest.capabilities,
    };
  }

  async getPluginUiBridge(actorUserId: string, pluginId: string) {
    const [row] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!row) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, row.companyId, "audit:read");
    const plugin = mapPlugin(row);
    const resolvedConfig = await this.resolveSecretReferencesForCompany(row.companyId, plugin.config);
    return {
      pluginId: plugin.id,
      slug: plugin.slug,
      name: plugin.name,
      status: plugin.status,
      slots: plugin.manifest.ui ?? [],
      mountUrl: getPluginUiBridgeMount(plugin, resolvedConfig),
    };
  }

  private buildPluginActionResult(
    plugin: Plugin,
    kind: PluginRuntimeActionResult["kind"],
    key: string,
    ok: boolean,
    result: Record<string, unknown>,
  ): PluginRuntimeActionResult {
    return {
      pluginId: plugin.id,
      kind,
      key,
      ok,
      at: new Date().toISOString(),
      result,
    };
  }

  async invokePluginTool(
    actorUserId: string,
    pluginId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<PluginRuntimeActionResult> {
    const [row] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!row) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, row.companyId, "plugin:write");
    const plugin = mapPlugin(row);
    const tool = plugin.manifest.tools?.find((entry) => entry.name === toolName);
    if (!tool) {
      throw new Error("plugin_tool_not_found");
    }
    const resolvedConfig = await this.resolveSecretReferencesForCompany(row.companyId, plugin.config);
    const runtime = await executePluginRuntime(plugin, resolvedConfig, "tool", toolName, input);
    return this.buildPluginActionResult(plugin, "tool", toolName, runtime.ok && plugin.status === "active", {
      ...runtime.result,
      input,
      description: tool.description,
    });
  }

  async triggerPluginJob(
    actorUserId: string,
    pluginId: string,
    jobKey: string,
    input: Record<string, unknown>,
  ): Promise<PluginRuntimeActionResult> {
    const [row] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!row) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, row.companyId, "plugin:write");
    const plugin = mapPlugin(row);
    const job = plugin.manifest.jobs?.find((entry) => entry.key === jobKey);
    if (!job) {
      throw new Error("plugin_job_not_found");
    }
    const resolvedConfig = await this.resolveSecretReferencesForCompany(row.companyId, plugin.config);
    const runtime = await executePluginRuntime(plugin, resolvedConfig, "job", jobKey, input);
    return this.buildPluginActionResult(plugin, "job", jobKey, runtime.ok && plugin.status === "active", {
      ...runtime.result,
      input,
      schedule: job.schedule,
    });
  }

  async triggerPluginWebhook(
    actorUserId: string,
    pluginId: string,
    webhookKey: string,
    payload: Record<string, unknown>,
  ): Promise<PluginRuntimeActionResult> {
    const [row] = await this.db.select().from(schema.plugins).where(eq(schema.plugins.id, pluginId));
    if (!row) {
      throw new Error("not_found");
    }
    await this.requirePermission(actorUserId, row.companyId, "plugin:write");
    const plugin = mapPlugin(row);
    const webhook = plugin.manifest.webhooks?.find((entry) => entry.key === webhookKey);
    if (!webhook) {
      throw new Error("plugin_webhook_not_found");
    }
    const resolvedConfig = await this.resolveSecretReferencesForCompany(row.companyId, plugin.config);
    const runtime = await executePluginRuntime(plugin, resolvedConfig, "webhook", webhookKey, payload);
    return this.buildPluginActionResult(plugin, "webhook", webhookKey, runtime.ok && plugin.status === "active", {
      ...runtime.result,
      payload,
      description: webhook.description ?? null,
    });
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
