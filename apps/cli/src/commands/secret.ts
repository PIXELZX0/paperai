import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addCompanyOption } from "./options.js";

export function registerSecretCommands(program: Command, context: CommandContext) {
  const secret = program.command("secret").description("Company secret management");

  addCompanyOption(
    addApiOptions(
      secret
        .command("list")
        .description("List secrets for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listSecrets(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApiOptions(
      secret
        .command("create")
        .description("Create a company secret")
        .requiredOption("--name <name>", "secret name")
        .requiredOption("--value <value>", "secret value")
        .option("--value-hint <hint>", "masked hint shown in the UI")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(
            context.runtime,
            await client.createSecret(companyId!, {
              name: options.name,
              value: options.value,
              valueHint: options.valueHint ?? null,
            }),
          );
        }),
    ),
  );

  addApiOptions(
    secret
      .command("update")
      .description("Update a company secret")
      .argument("<secretId>", "secret id")
      .option("--value <value>", "new secret value")
      .option("--value-hint <hint>", "masked hint shown in the UI")
      .action(async (secretId: string, options) => {
        const client = await context.createApiClient({
          apiUrl: options.apiUrl,
          token: options.token,
        });
        printJson(
          context.runtime,
          await client.updateSecret(secretId, {
            value: options.value,
            valueHint: options.valueHint,
          }),
        );
      }),
  );
}
