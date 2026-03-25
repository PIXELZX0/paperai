import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { parseJsonObject } from "../lib/input.js";
import { printJson } from "../lib/output.js";
import { addApiOptions, addApprovalCreateOptions, addApprovalResolveOptions, addCompanyOption } from "./options.js";

export function registerApprovalCommands(program: Command, context: CommandContext) {
  const approval = program.command("approval").description("Approval commands");

  addCompanyOption(
    addApiOptions(
      approval
        .command("list")
        .description("List approvals for a company")
        .action(async (options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          const companyId = await context.resolveCompanyId(options.company);
          printJson(context.runtime, await client.listApprovals(companyId!));
        }),
    ),
  );

  addCompanyOption(
    addApprovalCreateOptions(
      addApiOptions(
        approval
          .command("create")
          .description("Create an approval request")
          .action(async (options) => {
            const client = await context.createApiClient({
              apiUrl: options.apiUrl,
              token: options.token,
            });
            const companyId = await context.resolveCompanyId(options.company);
            printJson(
              context.runtime,
              await client.createApproval(companyId!, {
                kind: options.kind,
                title: options.title,
                description: options.description,
                payload: parseJsonObject(options.payload, "payload") ?? {},
              }),
            );
          }),
      ),
    ),
  );

  addApprovalResolveOptions(
    addApiOptions(
      approval
        .command("resolve")
        .description("Resolve an approval request")
        .argument("<approvalId>", "approval id")
        .action(async (approvalId: string, options) => {
          const client = await context.createApiClient({
            apiUrl: options.apiUrl,
            token: options.token,
          });
          printJson(
            context.runtime,
            await client.resolveApproval(approvalId, options.status, options.resolutionNotes),
          );
        }),
    ),
  );
}
