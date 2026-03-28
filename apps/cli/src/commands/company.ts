import { Command, Option } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption } from "./options.js";

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

  addCompanyOption(
    addApiOptions(
      company
        .command("org")
        .description("Read the company org tree")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.getOrgTree(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("org-svg")
        .description("Render the company org chart as SVG")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          context.runtime.stdout.write(await client.getOrgChartSvg(companyId!));
          context.runtime.stdout.write("\n");
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("cost-overview")
        .description("Read aggregated company cost summaries")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.getCostOverview(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("finance-events")
        .description("List normalized finance events derived from company costs")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listFinanceEvents(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("quota-windows")
        .description("List the current monthly quota windows for company and agents")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listQuotaWindows(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("join-requests")
        .description("List pending and resolved join requests for the company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listJoinRequests(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("request-join")
        .description("Submit a human join request for the selected company")
        .addOption(new Option("--role <role>", "requested role").choices(["owner", "board_admin", "board_operator", "auditor", "viewer"]).default("viewer"))
        .option("--note <text>", "join request note")
        .option("--onboarding-title <text>", "optional onboarding title")
        .option("--onboarding-body <text>", "optional onboarding body")
        .option("--manifest <json>", "optional onboarding manifest JSON")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
            requireToken: false,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(
            context.runtime,
            await client.createHumanJoinRequest(companyId!, {
              role: options.role,
              note: options.note,
              onboardingTitle: options.onboardingTitle,
              onboardingBody: options.onboardingBody,
              manifest: options.manifest ? JSON.parse(options.manifest) : {},
            }),
          );
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      company
        .command("request-agent-join")
        .description("Submit an agent join request for the selected company")
        .requiredOption("--slug <slug>", "agent slug")
        .requiredOption("--name <name>", "agent display name")
        .requiredOption("--adapter-type <type>", "agent adapter type")
        .option("--title <text>", "agent title")
        .option("--capabilities <text>", "agent capabilities")
        .option("--adapter-config <json>", "adapter config JSON")
        .option("--runtime-config <json>", "runtime config JSON")
        .option("--permissions <csv>", "comma-separated board permissions")
        .option("--budget-monthly-cents <cents>", "agent monthly budget in cents", "0")
        .option("--note <text>", "join request note")
        .option("--onboarding-title <text>", "optional onboarding title")
        .option("--onboarding-body <text>", "optional onboarding body")
        .option("--manifest <json>", "optional onboarding manifest JSON")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(
            context.runtime,
            await client.createAgentJoinRequest(companyId!, {
              slug: options.slug,
              name: options.name,
              title: options.title,
              capabilities: options.capabilities,
              adapterType: options.adapterType,
              adapterConfig: options.adapterConfig ? JSON.parse(options.adapterConfig) : {},
              runtimeConfig: options.runtimeConfig ? JSON.parse(options.runtimeConfig) : {},
              permissions: typeof options.permissions === "string" && options.permissions.length > 0 ? options.permissions.split(",").map((value: string) => value.trim()).filter(Boolean) : [],
              budgetMonthlyCents: Number(options.budgetMonthlyCents ?? 0),
              note: options.note,
              onboardingTitle: options.onboardingTitle,
              onboardingBody: options.onboardingBody,
              manifest: options.manifest ? JSON.parse(options.manifest) : {},
            }),
          );
        }),
    ),
  );

  addApiOptions(
    company
      .command("resolve-join-request")
      .description("Resolve a company join request")
      .argument("<joinRequestId>", "join request id")
      .addOption(new Option("--status <status>", "resolution status").choices(["approved", "rejected", "cancelled"]).makeOptionMandatory())
      .addOption(new Option("--role <role>", "approved role override").choices(["owner", "board_admin", "board_operator", "auditor", "viewer"]))
      .option("--resolution-notes <text>", "resolution notes")
      .action(async (joinRequestId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(
          context.runtime,
          await client.resolveJoinRequest(joinRequestId, {
            status: options.status,
            role: options.role,
            resolutionNotes: options.resolutionNotes,
          }),
        );
      }),
  );
}
