import type { Agent, Company, Task } from "@paperai/shared";

export function buildExecutionInstructions(company: Company, agent: Agent, task: Task | null): string {
  return [
    `Company: ${company.name}`,
    `Agent: ${agent.name}${agent.title ? ` (${agent.title})` : ""}`,
    task ? `Task: ${task.title}` : "Task: No assigned task",
    task?.description ? `Task details: ${task.description}` : "",
    agent.capabilities ? `Capabilities: ${agent.capabilities}` : "",
    "Operate autonomously, stay within budget, and report work as structured progress.",
  ]
    .filter(Boolean)
    .join("\n");
}
