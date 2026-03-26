import type {
  ActivityKind,
  AgentAdapterType,
  AgentStatus,
  ApprovalKind,
  ApprovalStatus,
  BoardPermission,
  BudgetScope,
  CompanyStatus,
  GoalLevel,
  GoalStatus,
  HeartbeatStatus,
  HeartbeatTriggerKind,
  IssuePriority,
  IssueStatus,
  MembershipRole,
  PluginStatus,
  ProjectStatus,
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

export interface CompanyMember extends Membership {
  user: Pick<AuthUser, "id" | "email" | "name">;
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
  level: GoalLevel;
  status: GoalStatus;
  parentId: string | null;
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
  status: ProjectStatus;
  targetDate: string | null;
  color: string | null;
  archivedAt: string | null;
  ownerAgentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  companyId: string;
  projectId: string | null;
  goalId: string | null;
  parentId: string | null;
  assigneeAgentId: string | null;
  createdByUserId: string | null;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  checkoutHeartbeatRunId: string | null;
  originKind: string;
  originRef: string | null;
  metadata: Record<string, unknown>;
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

export interface IssueComment {
  id: string;
  issueId: string;
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
  biller: string;
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
  email?: string;
  type?: "user" | "agent";
  agentId?: string | null;
  boardApiKeyId?: string | null;
  agentApiKeyId?: string | null;
}

export interface AgentRuntimeState {
  agentId: string;
  status: Agent["status"];
  sessionState: Agent["sessionState"];
  lastHeartbeatAt: string | null;
  lastHeartbeatRunId: string | null;
  lastHeartbeatStatus: HeartbeatRun["status"] | null;
  updatedAt: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  heartbeatRunId: string | null;
  summary: string | null;
  sessionState: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentApiKeyCreated {
  id: string;
  agentId: string;
  name: string;
  token: string;
  createdAt: string;
}

export interface BoardApiKeyCreated {
  id: string;
  userId: string;
  name: string;
  token: string;
  createdAt: string;
}

export interface BoardClaimChallenge {
  id: string;
  token: string;
  code: string;
  claimedByUserId: string | null;
  expiresAt: string;
  createdAt: string;
  claimedAt: string | null;
}

export interface CliAuthChallenge {
  id: string;
  challengeToken: string;
  requestedByUserId: string | null;
  approvedByUserId: string | null;
  boardApiKeyId: string | null;
  approved: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface CliAuthChallengeStatus extends CliAuthChallenge {
  approvedAt: string | null;
  consumedAt: string | null;
  boardToken: string | null;
  name: string | null;
}

export interface BootstrapCeoResult {
  user: AuthUser;
  company: Company;
  membership: Membership;
  boardClaim: BoardClaimChallenge;
}

export interface AgentAccessTokenCreated {
  agentId: string;
  expiresAt: string;
  token: string;
}

export interface ProjectWorkspace {
  id: string;
  companyId: string;
  projectId: string;
  name: string;
  cwd: string | null;
  repoUrl: string | null;
  repoRef: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionWorkspace {
  id: string;
  companyId: string;
  projectId: string | null;
  issueId: string | null;
  name: string;
  cwd: string | null;
  repoUrl: string | null;
  baseRef: string | null;
  branchName: string | null;
  mode: "shared_workspace" | "isolated_workspace" | "adapter_managed";
  status: "active" | "idle" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface CompanySkill {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  description: string | null;
  markdown: string;
  sourceType: "local_path" | "github" | "url";
  sourceLocator: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Secret {
  id: string;
  companyId: string;
  name: string;
  provider: "local";
  valueHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IssueDocumentSummary {
  id: string;
  issueId: string;
  key: string;
  title: string;
  format: "markdown" | "text";
  latestRevisionId: string | null;
  updatedAt: string;
}

export interface IssueDocument extends IssueDocumentSummary {
  body: string;
}

export interface IssueDocumentRevision {
  id: string;
  documentId: string;
  body: string;
  createdByUserId: string | null;
  createdByAgentId: string | null;
  createdAt: string;
}

export interface IssueAttachment {
  id: string;
  companyId: string;
  issueId: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface IssueWorkProduct {
  id: string;
  issueId: string;
  kind: string;
  title: string;
  content: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CostSummary {
  monthSpendCents: number;
  companyBudgetCents: number;
  utilizationRatio: number;
}

export interface CostSummaryByAgent {
  agentId: string;
  amountCents: number;
}

export interface CostSummaryByProject {
  projectId: string | null;
  amountCents: number;
}

export interface CostSummaryByProvider {
  provider: string;
  amountCents: number;
}

export interface CostSummaryByBiller {
  biller: string;
  amountCents: number;
}

export interface CompanyCostOverview {
  summary: CostSummary;
  byAgent: CostSummaryByAgent[];
  byProject: CostSummaryByProject[];
  byProvider: CostSummaryByProvider[];
  byBiller: CostSummaryByBiller[];
}

export interface PluginHealth {
  pluginId: string;
  status: "healthy" | "degraded" | "disabled";
  message: string;
  checkedAt: string;
  capabilities: PluginManifest["capabilities"];
}

export interface PluginRuntimeActionResult {
  pluginId: string;
  kind: "tool" | "job" | "webhook" | "ui";
  key: string;
  ok: boolean;
  at: string;
  result: Record<string, unknown>;
}

export interface PaperAiDatabaseBackupConfig {
  dir: string;
}

export interface PaperAiDatabaseConfig {
  mode: "embedded-postgres" | "postgres";
  connectionString?: string;
  embeddedDataDir: string;
  embeddedPort: number;
  backup: PaperAiDatabaseBackupConfig;
}

export interface PaperAiServerConfig {
  host: string;
  port: number;
  webOrigin: string;
  jwtSecret: string;
}

export interface PaperAiAuthConfig {
  boardClaimTtlMinutes: number;
  cliChallengeTtlMinutes: number;
  agentTokenTtlMinutes: number;
}

export interface PaperAiConfig {
  version: 1;
  database: PaperAiDatabaseConfig;
  server: PaperAiServerConfig;
  auth: PaperAiAuthConfig;
}
