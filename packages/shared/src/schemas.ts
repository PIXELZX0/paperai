import { z } from "zod";
import {
  AGENT_ADAPTER_TYPES,
  APPROVAL_KINDS,
  APPROVAL_STATUSES,
  MEMBERSHIP_ROLES,
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

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBERSHIP_ROLES),
});

export const createGoalSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  ownerAgentId: z.string().uuid().optional().nullable(),
});

export const createProjectSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().optional(),
  goalId: z.string().uuid().optional().nullable(),
  ownerAgentId: z.string().uuid().optional().nullable(),
});

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

export const createTaskCommentSchema = z.object({
  body: z.string().min(1),
});

export const checkoutTaskSchema = z.object({
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
