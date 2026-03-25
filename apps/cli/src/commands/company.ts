import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";
import { addApiOptions } from "./options.js";

export function registerCompanyCommands(program: Command, context: CommandContext) {
  const company = program.command("company").description("Company selection helpers");

  addApiOptions(
    company
      .command("list")
      .description("List companies visible to the authenticated user")
      .action(async (options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(context.runtime, await client.listCompanies());
      }),
  );

  addApiOptions(
    company
      .command("use")
      .description("Set the default company id in the local papercli profile")
      .argument("<company>", "company id or slug")
      .action(async (companyRef: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        const companies = await client.listCompanies();
        const selected = companies.find((entry) => entry.id === companyRef || entry.slug === companyRef);

        if (!selected) {
          throw new Error(`Company not found: ${companyRef}`);
        }

        const profile = await context.loadProfile();
        const profilePath = await context.saveProfile({
          ...profile,
          defaultCompanyId: selected.id,
        });

        printJson(context.runtime, {
          profilePath,
          company: selected,
        });
      }),
  );
}
