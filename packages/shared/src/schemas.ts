import { z } from "zod";
import {
  AGENT_ADAPTER_TYPES,
  APPROVAL_KINDS,
  APPROVAL_STATUSES,
  COMPANY_STATUSES,
  GOAL_LEVELS,
  GOAL_STATUSES,
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  MEMBERSHIP_ROLES,
  PROJECT_STATUSES,
  TASK_LIFECYCLE_STATUSES,
  TASK_PRIORITIES,
} from "./constants.js";

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  inviteToken: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createCompanySchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().optional(),
  brandColor: z.string().optional(),
  monthlyBudgetCents: z.number().int().nonnegative().default(0),
});

export const updateCompanySchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(2).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(COMPANY_STATUSES).optional(),
  brandColor: z.string().optional().nullable(),
  monthlyBudgetCents: z.number().int().nonnegative().optional(),
});

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBERSHIP_ROLES),
});

export const createGoalSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  level: z.enum(GOAL_LEVELS).default("task"),
  status: z.enum(GOAL_STATUSES).default("planned"),
  parentId: z.string().uuid().optional().nullable(),
  ownerAgentId: z.string().uuid().optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const createProjectSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().optional(),
  goalId: z.string().uuid().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).default("backlog"),
  targetDate: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  ownerAgentId: z.string().uuid().optional().nullable(),
  archivedAt: z.string().datetime().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const createAgentSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  title: z.string().optional(),
  capabilities: z.string().optional(),
  parentAgentId: z.string().uuid().optional().nullable(),
  adapterType: z.enum(AGENT_ADAPTER_TYPES),
  adapterConfig: z.record(z.unknown()).default({}),
  runtimeConfig: z.record(z.unknown()).default({}),
  permissions: z.array(z.string()).default([]),
  budgetMonthlyCents: z.number().int().nonnegative().default(0),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  parentTaskId: z.string().uuid().optional().nullable(),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(TASK_LIFECYCLE_STATUSES).default("backlog"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  originKind: z.string().default("manual"),
  originRef: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  status: z.enum(TASK_LIFECYCLE_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

export const createIssueSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
  assigneeAgentId: z.string().uuid().optional().nullable(),
  title: z.string().min(2),
  description: z.string().optional(),
  status: z.enum(ISSUE_STATUSES).default("backlog"),
  priority: z.enum(ISSUE_PRIORITIES).default("medium"),
  originKind: z.string().default("manual"),
  originRef: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateIssueSchema = createIssueSchema.partial().extend({
  status: z.enum(ISSUE_STATUSES).optional(),
  priority: z.enum(ISSUE_PRIORITIES).optional(),
});

export const createTaskCommentSchema = z.object({
  body: z.string().min(1),
});

export const createIssueCommentSchema = z.object({
  body: z.string().min(1),
});

export const checkoutTaskSchema = z.object({
  agentId: z.string().uuid(),
  heartbeatRunId: z.string().uuid().optional(),
});

export const checkoutIssueSchema = z.object({
  agentId: z.string().uuid(),
  heartbeatRunId: z.string().uuid().optional(),
});

export const createApprovalSchema = z.object({
  kind: z.enum(APPROVAL_KINDS),
  title: z.string().min(2),
  description: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
});

export const resolveApprovalSchema = z.object({
  status: z.enum(APPROVAL_STATUSES).refine((value) => value === "approved" || value === "rejected"),
  resolutionNotes: z.string().optional(),
});

export const createRoutineSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  name: z.string().min(2),
  description: z.string().optional(),
  cron: z.string().min(5),
  taskTemplate: z.record(z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export const pluginManifestSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  version: z.string().min(1),
  capabilities: z.array(z.enum(["tool", "job", "webhook", "ui"])).min(1),
  tools: z.array(z.object({ name: z.string().min(1), description: z.string().min(1) })).optional(),
  jobs: z.array(z.object({ key: z.string().min(1), schedule: z.string().min(5), description: z.string().optional() })).optional(),
  webhooks: z.array(z.object({ key: z.string().min(1), description: z.string().optional() })).optional(),
  ui: z.array(z.object({ slot: z.string().min(1), title: z.string().min(1) })).optional(),
});

export const createPluginSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  manifest: pluginManifestSchema,
  config: z.record(z.unknown()).default({}),
});

export const importCompanyPackageSchema = z.object({
  root: z.string().min(1),
});

export const createProjectWorkspaceSchema = z.object({
  name: z.string().min(1),
  cwd: z.string().optional().nullable(),
  repoUrl: z.string().optional().nullable(),
  repoRef: z.string().optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export const createExecutionWorkspaceSchema = z.object({
  projectId: z.string().uuid().optional().nullable(),
  issueId: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  cwd: z.string().optional().nullable(),
  repoUrl: z.string().optional().nullable(),
  baseRef: z.string().optional().nullable(),
  branchName: z.string().optional().nullable(),
  mode: z.enum(["shared_workspace", "isolated_workspace", "adapter_managed"]).default("shared_workspace"),
  status: z.enum(["active", "idle", "archived"]).default("active"),
});

export const createCompanySkillSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  markdown: z.string().default(""),
  sourceType: z.enum(["local_path", "github", "url"]).default("local_path"),
  sourceLocator: z.string().optional().nullable(),
});

export const updateCompanySkillSchema = createCompanySkillSchema.partial();

export const scanCompanySkillsSchema = z.object({
  root: z.string().min(1),
  upsert: z.boolean().default(true),
});

export const createSecretSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
  valueHint: z.string().optional().nullable(),
});

export const updateSecretSchema = z.object({
  value: z.string().min(1).optional(),
  valueHint: z.string().optional().nullable(),
});

export const createIssueDocumentSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  format: z.enum(["markdown", "text"]).default("markdown"),
  body: z.string().default(""),
});

export const updateIssueDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  format: z.enum(["markdown", "text"]).optional(),
  body: z.string().optional(),
});

export const createIssueAttachmentSchema = z.object({
  name: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative().default(0),
  url: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const createIssueWorkProductSchema = z.object({
  kind: z.string().min(1),
  title: z.string().min(1),
  content: z.record(z.unknown()).default({}),
});

export const updatePluginStatusSchema = z.object({
  status: z.enum(["active", "disabled"]),
});

export const upgradePluginSchema = z.object({
  manifest: pluginManifestSchema,
  config: z.record(z.unknown()).default({}),
});

export const invokePluginToolSchema = z.object({
  toolName: z.string().min(1),
  input: z.record(z.unknown()).default({}),
});

export const triggerPluginJobSchema = z.object({
  jobKey: z.string().min(1),
  input: z.record(z.unknown()).default({}),
});

export const triggerPluginWebhookSchema = z.object({
  webhookKey: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export const paperAiDatabaseBackupConfigSchema = z.object({
  dir: z.string().min(1),
});

export const paperAiDatabaseConfigSchema = z
  .object({
    mode: z.enum(["embedded-postgres", "postgres"]).default("embedded-postgres"),
    connectionString: z.string().min(1).optional(),
    embeddedDataDir: z.string().min(1),
    embeddedPort: z.number().int().positive().default(54329),
    backup: paperAiDatabaseBackupConfigSchema,
  })
  .superRefine((value, ctx) => {
    if (value.mode === "postgres" && !value.connectionString) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "connectionString is required when database.mode=postgres",
        path: ["connectionString"],
      });
    }
  });

export const paperAiServerConfigSchema = z.object({
  host: z.string().min(1).default("127.0.0.1"),
  port: z.number().int().positive().default(3001),
  webOrigin: z.string().url().default("http://localhost:5173"),
  jwtSecret: z.string().min(8).default("change-me-paperai"),
});

export const paperAiAuthConfigSchema = z.object({
  boardClaimTtlMinutes: z.number().int().positive().default(30),
  cliChallengeTtlMinutes: z.number().int().positive().default(10),
  agentTokenTtlMinutes: z.number().int().positive().default(60),
});

export const paperAiConfigSchema = z.object({
  version: z.literal(1).default(1),
  database: paperAiDatabaseConfigSchema,
  server: paperAiServerConfigSchema,
  auth: paperAiAuthConfigSchema,
});

export const createBoardClaimChallengeSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const claimBoardChallengeSchema = z.object({
  code: z.string().min(4),
});

export const createCliAuthChallengeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export const approveCliAuthChallengeSchema = z.object({
  challengeToken: z.string().min(16),
});

export const createAgentApiKeySchema = z.object({
  name: z.string().min(1).max(120),
});

export const bootstrapCeoSchema = z.object({
  token: z.string().min(16),
  code: z.string().min(4),
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
  company: z.object({
    slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    name: z.string().min(2),
    description: z.string().optional(),
    brandColor: z.string().optional(),
    monthlyBudgetCents: z.number().int().nonnegative().default(0),
  }),
});

export const createAgentAccessTokenSchema = z.object({
  expiresInMinutes: z.number().int().positive().max(60 * 24 * 30).optional(),
});
