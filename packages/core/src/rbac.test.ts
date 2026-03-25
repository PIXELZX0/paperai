import { describe, expect, it } from "vitest";
import { hasBoardPermission } from "./rbac.js";

describe("hasBoardPermission", () => {
  it("allows owners to resolve approvals", () => {
    expect(hasBoardPermission("owner", "approval:resolve")).toBe(true);
  });

  it("prevents viewers from mutating tasks", () => {
    expect(hasBoardPermission("viewer", "task:write")).toBe(false);
  });

  it("allows auditors to read audit logs", () => {
    expect(hasBoardPermission("auditor", "audit:read")).toBe(true);
  });
});
