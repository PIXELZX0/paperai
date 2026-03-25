import type {
  ActivityKind,
  AgentAdapterType,
  AgentStatus,
  ApprovalKind,
  ApprovalStatus,
  BoardPermission,
  BudgetScope,
  CompanyStatus,
  HeartbeatStatus,
  HeartbeatTriggerKind,
  MembershipRole,
  PluginStatus,
  TaskLifecycleStatus,
  TaskPriority,
} from "./constants.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Company {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: CompanyStatus;
  brandColor: string | null;
  monthlyBudgetCents: number;
  spentMonthlyCents: number;
  packageSource: CompanyPackageSource | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPackageSource {
  type: "directory" | "git";
  locator: string;
  reference?: string | null;
  importedAt?: string | null;
}

export interface Membership {
  id: string;
  companyId: string;
  userId: string;
  role: MembershipRole;
  createdAt: string;
}

export interface Invite {
  id: string;
  companyId: string;
  email: string;
  role: MembershipRole;
  token: string;
  invitedByUserId: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  companyId: string;
  title: string;
  description: string | null;
  ownerAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  goalId: string | null;
  slug: string;
  name: string;
  description: string | null;
  ownerAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  parentAgentId: string | null;
  slug: string;
  name: string;
  title: string | null;
  capabilities: string | null;
  status: AgentStatus;
  adapterType: AgentAdapterType;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  permissions: BoardPermission[];
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  sessionState: Record<string, unknown> | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  parentTaskId: string | null;
  assigneeAgentId: string | null;
  createdByUserId: string | null;
  title: string;
  description: string | null;
  status: TaskLifecycleStatus;
  priority: TaskPriority;
  checkoutHeartbeatRunId: string | null;
  originKind: string;
  originRef: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  companyId: string;
  authorUserId: string | null;
  authorAgentId: string | null;
  body: string;
  createdAt: string;
}

export interface HeartbeatRun {
  id: string;
  companyId: string;
  agentId: string;
  triggerKind: HeartbeatTriggerKind;
  triggerDetail: string | null;
  status: HeartbeatStatus;
  taskId: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  usage: Record<string, unknown> | null;
  log: string | null;
  costCents: number;
  sessionBefore: Record<string, unknown> | null;
  sessionAfter: Record<string, unknown> | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  companyId: string;
  requestedByUserId: string | null;
  requestedByAgentId: string | null;
  kind: ApprovalKind;
  status: ApprovalStatus;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetPolicy {
  id: string;
  companyId: string;
  agentId: string | null;
  scope: BudgetScope;
  monthlyLimitCents: number;
  hardStop: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CostEvent {
  id: string;
  companyId: string;
  agentId: string | null;
  heartbeatRunId: string | null;
  amountCents: number;
  currency: string;
  provider: string;
  model: string | null;
  direction: "debit" | "credit";
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  companyId: string;
  actorUserId: string | null;
  actorAgentId: string | null;
  kind: ActivityKind;
  targetType: string;
  targetId: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Routine {
  id: string;
  companyId: string;
  projectId: string | null;
  name: string;
  description: string | null;
  cron: string;
  taskTemplate: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Plugin {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  status: PluginStatus;
  manifest: PluginManifest;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptEntry {
  type: "stdout" | "stderr" | "info";
  message: string;
  at: string;
  metadata?: Record<string, unknown>;
}

export interface AdapterUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  provider?: string;
  model?: string;
  costCents?: number;
}

export interface AdapterExecutionContext {
  company: Company;
  agent: Agent;
  task: Task | null;
  instructions: string;
  env: Record<string, string>;
  session: Record<string, unknown> | null;
  cwd?: string | null;
}

export interface AdapterExecutionResult {
  ok: boolean;
  exitCode: number;
  error?: string;
  clearSession?: boolean;
  transcript: TranscriptEntry[];
  usage?: AdapterUsage;
  result?: Record<string, unknown>;
  session?: Record<string, unknown> | null;
}

export interface AdapterDefinition {
  type: AgentAdapterType;
  label: string;
  description: string;
  supportsSessions: boolean;
  validateConfig(config: Record<string, unknown>): Promise<AdapterDiagnostic[]>;
  execute(context: AdapterExecutionContext): Promise<AdapterExecutionResult>;
}

export interface AdapterDiagnostic {
  level: "error" | "warn" | "info";
  message: string;
}

export interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  capabilities: Array<"tool" | "job" | "webhook" | "ui">;
  tools?: Array<{ name: string; description: string }>;
  jobs?: Array<{ key: string; schedule: string; description?: string }>;
  webhooks?: Array<{ key: string; description?: string }>;
  ui?: Array<{ slot: string; title: string }>;
}

export interface CompanyPackageDoc {
  kind: "company" | "team" | "agent" | "project" | "task" | "skill";
  path: string;
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface CompanyPackageManifest {
  root: string;
  company: CompanyPackageDoc | null;
  docs: CompanyPackageDoc[];
  vendorConfig: Record<string, unknown> | null;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
}
