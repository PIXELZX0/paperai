import type { Agent, Company, Task } from "@paperai/shared";

function isChiefExecutiveOfficer(agent: Agent): boolean {
  const slug = agent.slug.toLowerCase();
  const name = agent.name.toLowerCase();
  const title = agent.title?.toLowerCase() ?? "";

  return slug === "ceo" || name === "ceo" || title.includes("chief executive officer") || title === "ceo";
}

export function buildExecutionInstructions(company: Company, agent: Agent, task: Task | null): string {
  const roleInstructions = isChiefExecutiveOfficer(agent)
    ? [
        "CEO responsibility: define and maintain the company's identity, positioning, tone of voice, and visual direction.",
        "Own the canonical design_guide.md. If it is missing, incomplete, or outdated, create or revise it before approving downstream design work.",
        "Use design_guide.md to keep product, marketing, and internal operator experiences visually and verbally consistent.",
      ]
    : [];

  return [
    `Company: ${company.name}`,
    `Agent: ${agent.name}${agent.title ? ` (${agent.title})` : ""}`,
    task ? `Task: ${task.title}` : "Task: No assigned task",
    task?.description ? `Task details: ${task.description}` : "",
    agent.capabilities ? `Capabilities: ${agent.capabilities}` : "",
    ...roleInstructions,
    "Operate autonomously, stay within budget, and report work as structured progress.",
  ]
    .filter(Boolean)
    .join("\n");
}
