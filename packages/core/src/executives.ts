import type { Agent } from "@paperai/shared";

export function isChiefExecutiveOfficer(agent: Pick<Agent, "slug" | "name" | "title">): boolean {
  const slug = agent.slug.toLowerCase();
  const name = agent.name.toLowerCase();
  const title = agent.title?.toLowerCase() ?? "";

  return slug === "ceo" || name === "ceo" || title.includes("chief executive officer") || title === "ceo";
}
