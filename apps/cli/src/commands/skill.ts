import { Command, Option } from "commander";
import type { CompanySkill } from "@paperai/shared";
import type { CommandContext } from "../lib/context.js";
import { readBodyInput } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addBodyOptions, addCompanyOption } from "./options.js";

export function registerSkillCommands(program: Command, context: CommandContext) {
  const skill = program.command("skill").description("Company skill library commands");

  addCompanyOption(
    addApiOptions(
      skill
        .command("list")
        .description("List skills for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listSkills(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addBodyOptions(
      addApiOptions(
        skill
          .command("create")
          .description("Create a company skill")
          .requiredOption("--slug <slug>", "skill slug")
          .requiredOption("--name <name>", "skill name")
          .option("--description <text>", "skill description")
          .addOption(
            new Option("--source-type <type>", "skill source type")
              .choices(["local_path", "github", "url"])
              .default("local_path"),
          )
          .option("--source-locator <locator>", "source location")
          .action(async (options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const companyId = await context.resolveCompanyId(options.company);
            const markdown = await readBodyInput(context.runtime, options, true);
            printJson(
              context.runtime,
              await client.createSkill(companyId!, {
                slug: options.slug,
                name: options.name,
                description: options.description ?? null,
                markdown: markdown!,
                sourceType: options.sourceType as CompanySkill["sourceType"],
                sourceLocator: options.sourceLocator ?? null,
              }),
            );
          }),
      ),
    ),
  );

  addBodyOptions(
    addApiOptions(
      skill
        .command("update")
        .description("Update a company skill")
        .argument("<skillId>", "skill id")
        .option("--slug <slug>", "skill slug")
        .option("--name <name>", "skill name")
        .option("--description <text>", "skill description")
        .addOption(new Option("--source-type <type>", "skill source type").choices(["local_path", "github", "url"]))
        .option("--source-locator <locator>", "source location")
        .action(async (skillId: string, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const markdown = await readBodyInput(context.runtime, options, false);
          printJson(
            context.runtime,
            await client.updateSkill(skillId, {
              slug: options.slug,
              name: options.name,
              description: options.description,
              markdown,
              sourceType: options.sourceType as CompanySkill["sourceType"] | undefined,
              sourceLocator: options.sourceLocator,
            }),
          );
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      skill
        .command("scan")
        .description("Scan a directory for local skills and import them")
        .requiredOption("--root <path>", "scan root")
        .option("--no-upsert", "skip updating existing skills")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.scanSkills(companyId!, options.root, options.upsert));
        }),
    ),
  );
}
