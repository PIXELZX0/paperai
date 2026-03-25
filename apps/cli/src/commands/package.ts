import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { parseCompanyPackage } from "@paperai/company-package";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption } from "./options.js";

export async function scaffoldCompanyPackage(dir: string) {
  await mkdir(path.join(dir, "agents", "ceo"), { recursive: true });
  await writeFile(
    path.join(dir, "COMPANY.md"),
    `---\nschema: agentcompanies/v1\nkind: company\nslug: paperai-company\nname: PaperAI Company\ndescription: General autonomous company\n---\n\nRun a general-purpose zero-human company.\n`,
  );
  await writeFile(
    path.join(dir, "agents", "ceo", "AGENTS.md"),
    `---\nkind: agent\nslug: ceo\nname: CEO\ntitle: Chief Executive Officer\n---\n\nOwn company strategy, identity, and governance. Define the company's positioning, tone of voice, and visual direction before delegating downstream work. Create and maintain the canonical \`design_guide.md\` so product, marketing, and internal tools follow one consistent design system and brand standard. Coordinate strategy, goals, and approvals.\n`,
  );
  await writeFile(
    path.join(dir, ".zero.yaml"),
    `adapters:\n  ceo:\n    type: http_api\n    adapterConfig: {}\n`,
  );
}

export async function inspectPackageAction(context: CommandContext, root: string) {
  printJson(context.runtime, await parseCompanyPackage(root));
}

export async function importPackageAction(
  context: CommandContext,
  options: { apiUrl?: string; token?: string; company?: string; root: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  const companyId = await context.resolveCompanyId(options.company);
  printJson(context.runtime, await client.importPackage(companyId!, options.root));
}

export async function exportPackageAction(
  context: CommandContext,
  options: { apiUrl?: string; token?: string; company?: string },
) {
  const client = await context.createApiClient({
    apiUrl: options.apiUrl,
    token: options.token,
  });
  const companyId = await context.resolveCompanyId(options.company);
  printJson(context.runtime, await client.exportPackage(companyId!));
}

export function registerPackageCommands(program: Command, context: CommandContext) {
  const packageCommand = program.command("package").description("Company package helpers");

  packageCommand
    .command("init")
    .description("Create a minimal company package scaffold")
    .argument("[dir]", "directory to initialize", "paperai-company")
    .action(async (dir: string) => {
      await scaffoldCompanyPackage(dir);
      printJson(context.runtime, {
        ok: true,
        root: dir,
      });
    });

  packageCommand
    .command("inspect")
    .description("Inspect a local company package")
    .argument("<root>", "package directory")
    .action(async (root: string) => {
      await inspectPackageAction(context, root);
    });

  addCompanyOption(
    addApiOptions(
      packageCommand
        .command("import")
        .description("Import a local company package into PaperAI")
        .requiredOption("--root <root>", "package directory")
        .action(async (options) => {
          await importPackageAction(context, options);
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      packageCommand
        .command("export")
        .description("Export a company package from PaperAI")
        .action(async (options) => {
          await exportPackageAction(context, options);
        }),
    ),
  );
}
