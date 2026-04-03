import { describe, expect, it } from "vitest";
import { buildExecutionInstructions } from "./context.js";
import { isChiefExecutiveOfficer } from "./executives.js";
import type { Agent, Company, Task } from "@paperai/shared";

function createCompany(): Company {
  return {
    id: "company-1",
    slug: "paperai",
    name: "PaperAI",
    description: "Zero-human company control plane",
    status: "active",
    brandColor: null,
    monthlyBudgetCents: 100000,
    spentMonthlyCents: 0,
    packageSource: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
  };
}

function createTask(): Task {
  return {
    id: "task-1",
    companyId: "company-1",
    projectId: null,
    goalId: null,
    parentTaskId: null,
    assigneeAgentId: "agent-1",
    createdByUserId: null,
    title: "Define company direction",
    description: "Clarify the company's identity and governance model.",
    status: "todo",
    priority: "medium",
    checkoutHeartbeatRunId: null,
    originKind: "manual",
    originRef: null,
    metadata: {},
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
  };
}

function createAgent(input: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    companyId: "company-1",
    parentAgentId: null,
    departmentId: null,
    positionId: null,
    slug: "operator",
    name: "Operator",
    title: "Operations Lead",
    capabilities: "Handle operational workflows.",
    status: "idle",
    adapterType: "http_api",
    adapterConfig: {},
    runtimeConfig: {},
    permissions: [],
    budgetMonthlyCents: 10000,
    spentMonthlyCents: 0,
    sessionState: null,
    lastHeartbeatAt: null,
    createdAt: "2026-03-25T00:00:00.000Z",
    updatedAt: "2026-03-25T00:00:00.000Z",
    ...input,
  };
}

describe("buildExecutionInstructions", () => {
  it("adds company identity and design guide ownership for the CEO agent", () => {
    const instructions = buildExecutionInstructions(
      createCompany(),
      createAgent({
        slug: "ceo",
        name: "CEO",
        title: "Chief Executive Officer",
        capabilities: "Lead strategy and company governance.",
      }),
      createTask(),
    );

    expect(instructions).toContain("define and maintain the company's identity");
    expect(instructions).toContain("design_guide.md");
    expect(instructions).toContain("visually and verbally consistent");
  });

  it("does not add CEO-only guidance to other agents", () => {
    const instructions = buildExecutionInstructions(createCompany(), createAgent(), createTask());

    expect(instructions).not.toContain("design_guide.md");
    expect(instructions).not.toContain("define and maintain the company's identity");
  });

  it("adds department TEAM.md guidance for department_workspec tasks", () => {
    const instructions = buildExecutionInstructions(
      createCompany(),
      createAgent(),
      {
        ...createTask(),
        metadata: {
          kind: "department_workspec",
          targetFilePath: "/tmp/company/departments/engineering/TEAM.md",
        },
      },
    );

    expect(instructions).toContain("Department work-spec task");
    expect(instructions).toContain("Target file path");
    expect(instructions).toContain("Mission, Core Responsibilities");
  });
});

describe("isChiefExecutiveOfficer", () => {
  it("detects a CEO using title text", () => {
    expect(
      isChiefExecutiveOfficer({
        slug: "ops",
        name: "Operator",
        title: "Chief Executive Officer",
      }),
    ).toBe(true);
  });

  it("does not detect non-CEO roles", () => {
    expect(
      isChiefExecutiveOfficer({
        slug: "cto",
        name: "CTO",
        title: "Chief Technology Officer",
      }),
    ).toBe(false);
  });
});
