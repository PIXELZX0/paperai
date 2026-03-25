import type { BoardPermission, MembershipRole } from "@paperai/shared";

const PERMISSIONS_BY_ROLE: Record<MembershipRole, BoardPermission[]> = {
  owner: [
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
  ],
  board_admin: [
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
  ],
  board_operator: [
    "goal:write",
    "project:write",
    "task:write",
    "task:checkout",
    "agent:wake",
    "package:import",
    "package:export",
    "audit:read",
    "cost:read",
  ],
  auditor: ["audit:read", "cost:read"],
  viewer: [],
};

export function permissionsForRole(role: MembershipRole): BoardPermission[] {
  return PERMISSIONS_BY_ROLE[role];
}

export function hasBoardPermission(role: MembershipRole, permission: BoardPermission): boolean {
  return permissionsForRole(role).includes(permission);
}
