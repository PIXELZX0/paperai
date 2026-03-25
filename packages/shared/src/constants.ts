export const MEMBERSHIP_ROLES = ["owner", "board_admin", "board_operator", "auditor", "viewer"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const COMPANY_STATUSES = ["active", "paused", "archived"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const AGENT_STATUSES = ["idle", "running", "paused", "error", "terminated"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const AGENT_ADAPTER_TYPES = [
  "claude_code",
  "codex",
  "gemini_cli",
  "opencode",
  "http_api",
] as const;
export type AgentAdapterType = (typeof AGENT_ADAPTER_TYPES)[number];

export const TASK_LIFECYCLE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;
export type TaskLifecycleStatus = (typeof TASK_LIFECYCLE_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const HEARTBEAT_TRIGGER_KINDS = [
  "schedule",
  "assignment",
  "mention",
  "approval_resolution",
  "webhook",
  "manual",
] as const;
export type HeartbeatTriggerKind = (typeof HEARTBEAT_TRIGGER_KINDS)[number];

export const HEARTBEAT_STATUSES = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type HeartbeatStatus = (typeof HEARTBEAT_STATUSES)[number];

export const APPROVAL_KINDS = [
  "hire_agent",
  "terminate_agent",
  "budget_change",
  "policy_change",
  "plugin_action",
  "strategy_update",
] as const;
export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const BUDGET_SCOPES = ["company", "agent"] as const;
export type BudgetScope = (typeof BUDGET_SCOPES)[number];

export const ACTIVITY_KINDS = [
  "company.created",
  "membership.created",
  "invite.created",
  "goal.created",
  "project.created",
  "task.created",
  "task.updated",
  "task.checked_out",
  "task.commented",
  "agent.created",
  "agent.updated",
  "agent.wake_requested",
  "heartbeat.created",
  "heartbeat.updated",
  "approval.created",
  "approval.resolved",
  "budget.updated",
  "plugin.created",
  "package.imported",
  "package.exported",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const BOARD_PERMISSIONS = [
  "company:create",
  "company:update",
  "membership:invite",
  "membership:update",
  "goal:write",
  "project:write",
  "task:write",
  "task:checkout",
  "agent:write",
  "agent:wake",
  "approval:resolve",
  "budget:write",
  "plugin:write",
  "package:import",
  "package:export",
  "audit:read",
  "cost:read",
] as const;
export type BoardPermission = (typeof BOARD_PERMISSIONS)[number];

export const PLUGIN_STATUSES = ["draft", "active", "disabled"] as const;
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];
