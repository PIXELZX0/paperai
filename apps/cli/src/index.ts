#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parseCompanyPackage } from "@paperai/company-package";
import { validatePluginManifest } from "@paperai/plugin-sdk";

const program = new Command();
const apiBase = process.env.PAPERAI_API_URL ?? "http://localhost:3001/api/v1";
const token = process.env.PAPERAI_TOKEN ?? "";

async function request(pathname: string, init?: RequestInit) {
  const response = await fetch(`${apiBase}${pathname}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `request_failed:${response.status}`);
  }

  return await response.json();
}

program.name("paperai").description("CLI for the PaperAI zero-human company control plane");

program
  .command("init")
  .description("Create a minimal company package scaffold")
  .argument("[dir]", "directory to initialize", "paperai-company")
  .action(async (dir) => {
    await mkdir(path.join(dir, "agents", "ceo"), { recursive: true });
    await writeFile(
      path.join(dir, "COMPANY.md"),
      `---\nschema: agentcompanies/v1\nkind: company\nslug: paperai-company\nname: PaperAI Company\ndescription: General autonomous company\n---\n\nRun a general-purpose zero-human company.\n`,
    );
    await writeFile(
      path.join(dir, "agents", "ceo", "AGENTS.md"),
      `---\nkind: agent\nslug: ceo\nname: CEO\ntitle: Chief Executive Officer\n---\n\nCoordinate strategy, goals, and approvals.\n`,
    );
    await writeFile(
      path.join(dir, ".zero.yaml"),
      `adapters:\n  ceo:\n    type: http_api\n    adapterConfig: {}\n`,
    );
    console.log(`Initialized ${dir}`);
  });

program
  .command("dev")
  .description("Check API health")
  .action(async () => {
    const data = await fetch(apiBase.replace("/api/v1", "/health")).then((response) => response.json());
    console.log(JSON.stringify(data, null, 2));
  });

program
  .command("migrate")
  .description("Remind the operator to run db push from the workspace")
  .action(() => {
    console.log("Run `pnpm db:push` from the repo root to sync the database schema.");
  });

program
  .command("import-company")
  .requiredOption("--company <companyId>", "company id")
  .requiredOption("--root <root>", "package directory")
  .action(async (options) => {
    const result = await request(`/packages/import?companyId=${options.company}`, {
      method: "POST",
      body: JSON.stringify({ root: options.root }),
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("export-company")
  .requiredOption("--company <companyId>", "company id")
  .action(async (options) => {
    const result = await request(`/packages/export?companyId=${options.company}`);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("agent:test")
  .argument("<agentId>", "agent id")
  .action(async (agentId) => {
    const result = await request(`/agents/${agentId}/test`, { method: "POST" });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("agent:wake")
  .argument("<agentId>", "agent id")
  .action(async (agentId) => {
    const result = await request(`/agents/${agentId}/wake`, { method: "POST" });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("task:create")
  .requiredOption("--company <companyId>", "company id")
  .requiredOption("--title <title>", "task title")
  .option("--description <description>", "task description")
  .option("--assignee <agentId>", "assignee agent id")
  .action(async (options) => {
    const result = await request(`/tasks?companyId=${options.company}`, {
      method: "POST",
      body: JSON.stringify({
        title: options.title,
        description: options.description,
        assigneeAgentId: options.assignee ?? null,
        status: "todo",
        priority: "medium",
        originKind: "manual",
      }),
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("plugin:validate")
  .requiredOption("--manifest <json>", "plugin manifest JSON")
  .action(async (options) => {
    const manifest = JSON.parse(options.manifest) as Record<string, unknown>;
    const result = validatePluginManifest(manifest);
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("package:inspect")
  .argument("<root>", "package directory")
  .action(async (root) => {
    const manifest = await parseCompanyPackage(root);
    console.log(JSON.stringify(manifest, null, 2));
  });

void program.parseAsync();
