import {
  type AnyPgColumn,
  date,
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  brandColor: text("brand_color"),
  monthlyBudgetCents: integer("monthly_budget_cents").notNull().default(0),
  spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
  packageSource: jsonb("package_source").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserUnique: uniqueIndex("memberships_company_user_idx").on(table.companyId, table.userId),
  }),
);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  token: text("token").notNull().unique(),
  invitedByUserId: uuid("invited_by_user_id").notNull().references(() => users.id),
  onboardingTitle: text("onboarding_title"),
  onboardingBody: text("onboarding_body"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardClaimChallenges = pgTable("board_claim_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull().unique(),
  code: text("code").notNull(),
  claimedByUserId: uuid("claimed_by_user_id").references(() => users.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const boardApiKeys = pgTable("board_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cliAuthChallenges = pgTable("cli_auth_challenges", {
  id: uuid("id").primaryKey().defaultRandom(),
  challengeToken: text("challenge_token").notNull().unique(),
  name: text("name"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  approvedByUserId: uuid("approved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  boardApiKeyId: uuid("board_api_key_id").references(() => boardApiKeys.id, { onDelete: "set null" }),
  approvedToken: text("approved_token"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  level: text("level").notNull().default("task"),
  status: text("status").notNull().default("planned"),
  parentId: uuid("parent_id").references((): AnyPgColumn => goals.id, { onDelete: "set null" }),
  ownerAgentId: uuid("owner_agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  targetDate: date("target_date"),
  color: text("color"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ownerAgentId: uuid("owner_agent_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectWorkspaces = pgTable("project_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cwd: text("cwd"),
  repoUrl: text("repo_url"),
  repoRef: text("repo_ref"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isExecutive: boolean("is_executive").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUnique: uniqueIndex("positions_company_slug_idx").on(table.companyId, table.slug),
  }),
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    headAgentId: uuid("head_agent_id").references((): AnyPgColumn => agents.id, { onDelete: "set null" }),
    workSpecRelativePath: text("work_spec_relative_path").notNull(),
    lastWorkSpecTaskId: uuid("last_work_spec_task_id").references((): AnyPgColumn => tasks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companySlugUnique: uniqueIndex("departments_company_slug_idx").on(table.companyId, table.slug),
  }),
);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  parentAgentId: uuid("parent_agent_id"),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  positionId: uuid("position_id").references(() => positions.id, { onDelete: "set null" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  capabilities: text("capabilities"),
  status: text("status").notNull().default("idle"),
  adapterType: text("adapter_type").notNull(),
  adapterConfig: jsonb("adapter_config").$type<Record<string, unknown>>().notNull().default({}),
  runtimeConfig: jsonb("runtime_config").$type<Record<string, unknown>>().notNull().default({}),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
  budgetMonthlyCents: integer("budget_monthly_cents").notNull().default(0),
  spentMonthlyCents: integer("spent_monthly_cents").notNull().default(0),
  sessionState: jsonb("session_state").$type<Record<string, unknown> | null>(),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentApiKeys = pgTable("agent_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const joinRequests = pgTable("join_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  requestedByAgentId: uuid("requested_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  email: text("email"),
  role: text("role"),
  note: text("note"),
  onboardingTitle: text("onboarding_title"),
  onboardingBody: text("onboarding_body"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
  agentDraft: jsonb("agent_draft").$type<Record<string, unknown> | null>(),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
  parentTaskId: uuid("parent_task_id"),
  assigneeAgentId: uuid("assignee_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("backlog"),
  priority: text("priority").notNull().default("medium"),
  checkoutHeartbeatRunId: uuid("checkout_heartbeat_run_id"),
  originKind: text("origin_kind").notNull().default("manual"),
  originRef: text("origin_ref"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const executionWorkspaces = pgTable("execution_workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  issueId: uuid("issue_id").references(() => tasks.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  cwd: text("cwd"),
  repoUrl: text("repo_url"),
  baseRef: text("base_ref"),
  branchName: text("branch_name"),
  mode: text("mode").notNull().default("shared_workspace"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const companySkills = pgTable("company_skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  markdown: text("markdown").notNull().default(""),
  sourceType: text("source_type").notNull().default("local_path"),
  sourceLocator: text("source_locator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const secrets = pgTable("secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  provider: text("provider").notNull().default("local"),
  value: text("value").notNull(),
  valueHint: text("value_hint"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issueDocuments = pgTable("issue_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  title: text("title").notNull(),
  format: text("format").notNull().default("markdown"),
  body: text("body").notNull().default(""),
  latestRevisionId: uuid("latest_revision_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issueDocumentRevisions = pgTable("issue_document_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => issueDocuments.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdByAgentId: uuid("created_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issueAttachments = pgTable("issue_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  issueId: uuid("issue_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  url: text("url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const issueWorkProducts = pgTable("issue_work_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  issueId: uuid("issue_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  content: jsonb("content").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorAgentId: uuid("author_agent_id").references(() => agents.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const heartbeatRuns = pgTable("heartbeat_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
  triggerKind: text("trigger_kind").notNull(),
  triggerDetail: text("trigger_detail"),
  status: text("status").notNull().default("queued"),
  error: text("error"),
  result: jsonb("result").$type<Record<string, unknown> | null>(),
  usage: jsonb("usage").$type<Record<string, unknown> | null>(),
  log: text("log"),
  costCents: integer("cost_cents").notNull().default(0),
  sessionBefore: jsonb("session_before").$type<Record<string, unknown> | null>(),
  sessionAfter: jsonb("session_after").$type<Record<string, unknown> | null>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSessions = pgTable("agent_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
  summary: text("summary"),
  sessionState: jsonb("session_state").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, { onDelete: "set null" }),
  requestedByAgentId: uuid("requested_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("pending"),
  title: text("title").notNull(),
  description: text("description"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolutionNotes: text("resolution_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetPolicies = pgTable("budget_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  scope: text("scope").notNull(),
  monthlyLimitCents: integer("monthly_limit_cents").notNull(),
  hardStop: boolean("hard_stop").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const costEvents = pgTable("cost_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  heartbeatRunId: uuid("heartbeat_run_id").references(() => heartbeatRuns.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("USD"),
  biller: text("biller").notNull().default("platform"),
  provider: text("provider").notNull(),
  model: text("model"),
  direction: text("direction").notNull().default("debit"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routines = pgTable("routines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  cron: text("cron").notNull(),
  taskTemplate: jsonb("task_template").$type<Record<string, unknown>>().notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plugins = pgTable("plugins", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull().default({}),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityEvents = pgTable("activity_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  actorAgentId: uuid("actor_agent_id").references(() => agents.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  summary: text("summary").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
