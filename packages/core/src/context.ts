import type { Agent, Company, Task } from "@paperai/shared";
import { isChiefExecutiveOfficer } from "./executives.js";

function buildDepartmentWorkSpecInstructions(task: Task | null): string[] {
  if (!task || task.metadata.kind !== "department_workspec") {
    return [];
  }

  const targetFilePath = typeof task.metadata.targetFilePath === "string" ? task.metadata.targetFilePath : null;
  const requiredSections = [
    "Mission",
    "Core Responsibilities",
    "Collaboration Interfaces",
    "KPIs",
    "Operating Cadence",
    "Handover Rules",
  ];

  return [
    "Department work-spec task: create or update the department TEAM.md in the target filesystem path.",
    targetFilePath ? `Target file path: ${targetFilePath}` : "Target file path: (not provided in metadata)",
    `Required sections: ${requiredSections.join(", ")}.`,
    "Write practical, concrete operating guidance as production-ready markdown and keep language concise.",
  ];
}

export function buildExecutionInstructions(company: Company, agent: Agent, task: Task | null): string {
  const roleInstructions = isChiefExecutiveOfficer(agent)
    ? [
        "CEO responsibility: define and maintain the company's identity, positioning, tone of voice, and visual direction.",
        "Own the canonical design_guide.md. If it is missing, incomplete, or outdated, create or revise it before approving downstream design work.",
        "Use design_guide.md to keep product, marketing, and internal operator experiences visually and verbally consistent.",
      ]
    : [];
  const departmentWorkSpecInstructions = buildDepartmentWorkSpecInstructions(task);

  return [
    `Company: ${company.name}`,
    `Agent: ${agent.name}${agent.title ? ` (${agent.title})` : ""}`,
    task ? `Task: ${task.title}` : "Task: No assigned task",
    task?.description ? `Task details: ${task.description}` : "",
    agent.capabilities ? `Capabilities: ${agent.capabilities}` : "",
    ...roleInstructions,
    ...departmentWorkSpecInstructions,
    "Operate autonomously, stay within budget, and report work as structured progress.",
  ]
    .filter(Boolean)
    .join("\n");
}
