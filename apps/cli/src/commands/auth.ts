import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";

export function registerAuthCommands(program: Command, context: CommandContext) {
  const auth = program.command("auth").description("Authentication helpers");

  auth
    .command("login")
    .description("Log in and persist the token in the local papercli profile")
    .requiredOption("--email <email>", "user email")
    .requiredOption("--password <password>", "user password")
    .option("--api-url <url>", "PaperAI API base URL")
    .action(async (options) => {
      const apiUrl = await context.resolveApiUrl(options.apiUrl);
      const client = await context.createApiClient({
        apiUrl,
        requireToken: false,
      });
      const result = await client.login(options.email, options.password);
      const profile = await context.loadProfile();
      const profilePath = await context.saveProfile({
        ...profile,
        apiUrl,
        token: result.token,
      });

      printJson(context.runtime, {
        profilePath,
        apiUrl,
        token: result.token,
        user: result.user,
      });
    });

  auth
    .command("whoami")
    .description("Return the currently authenticated PaperAI user")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (options) => {
      const client = await context.createApiClient({
        apiUrl: options.apiUrl,
        token: options.token,
      });
      printJson(context.runtime, await client.me());
    });

  auth
    .command("logout")
    .description("Remove the saved token from the local papercli profile")
    .action(async () => {
      const profile = await context.loadProfile();
      const profilePath = await context.saveProfile({
        ...profile,
        token: undefined,
      });

      printJson(context.runtime, {
        ok: true,
        profilePath,
      });
    });
}
