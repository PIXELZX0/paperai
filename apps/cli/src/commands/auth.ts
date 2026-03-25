import { Command } from "commander";
import type { CommandContext } from "../lib/context.js";
import { printJson } from "../lib/output.js";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  auth
    .command("board-claim")
    .description("Create a board-claim challenge for first-time bootstrap")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--force", "create a new challenge even if the board appears claimed")
    .action(async (options) => {
      const client = await context.createApiClient({
        apiUrl: options.apiUrl,
        requireToken: false,
      });
      printJson(context.runtime, await client.createBoardClaimChallenge(Boolean(options.force)));
    });

  auth
    .command("bootstrap-ceo")
    .description("Bootstrap the first operator and initial company from a board claim")
    .requiredOption("--claim-token <token>", "board claim token")
    .requiredOption("--claim-code <code>", "board claim code")
    .requiredOption("--email <email>", "operator email")
    .requiredOption("--name <name>", "operator name")
    .requiredOption("--password <password>", "operator password")
    .requiredOption("--company-slug <slug>", "initial company slug")
    .requiredOption("--company-name <name>", "initial company name")
    .option("--company-description <text>", "initial company description")
    .option("--brand-color <value>", "company brand color")
    .option("--monthly-budget-cents <amount>", "initial monthly budget in cents")
    .option("--api-url <url>", "PaperAI API base URL")
    .action(async (options) => {
      const apiUrl = await context.resolveApiUrl(options.apiUrl);
      const client = await context.createApiClient({
        apiUrl,
        requireToken: false,
      });
      const result = await client.bootstrapChiefExecutiveOfficer({
        token: options.claimToken,
        code: options.claimCode,
        email: options.email,
        name: options.name,
        password: options.password,
        company: {
          slug: options.companySlug,
          name: options.companyName,
          description: options.companyDescription,
          brandColor: options.brandColor,
          monthlyBudgetCents: options.monthlyBudgetCents ? Number(options.monthlyBudgetCents) : 0,
        },
      });
      const login = await client.login(options.email, options.password);
      const profile = await context.loadProfile();
      const profilePath = await context.saveProfile({
        ...profile,
        apiUrl,
        token: login.token,
        defaultCompanyId: result.company.id,
      });

      printJson(context.runtime, {
        ...result,
        token: login.token,
        profilePath,
      });
    });

  auth
    .command("login-device")
    .description("Use the CLI auth challenge flow and save the approved board token")
    .option("--name <name>", "device name shown to the approver")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--poll-interval-seconds <seconds>", "poll interval", "2")
    .option("--timeout-seconds <seconds>", "how long to wait before returning", "120")
    .action(async (options) => {
      const apiUrl = await context.resolveApiUrl(options.apiUrl);
      const client = await context.createApiClient({
        apiUrl,
        requireToken: false,
      });

      const created = await client.createCliAuthChallenge(options.name);
      const timeoutAt = Date.now() + Number(options.timeoutSeconds) * 1000;
      let current = created;

      while (Date.now() < timeoutAt) {
        await sleep(Number(options.pollIntervalSeconds) * 1000);
        current = await client.getCliAuthChallengeStatus(created.id, created.challengeToken);
        if (current.approved && current.boardToken) {
          const profile = await context.loadProfile();
          const profilePath = await context.saveProfile({
            ...profile,
            apiUrl,
            token: current.boardToken,
          });

          printJson(context.runtime, {
            approved: true,
            challenge: current,
            profilePath,
          });
          return;
        }
      }

      printJson(context.runtime, {
        approved: false,
        challenge: current,
      });
    });

  auth
    .command("approve-device")
    .description("Approve a pending CLI auth challenge")
    .argument("<challengeId>", "challenge id")
    .requiredOption("--challenge-token <token>", "challenge token shown to the CLI")
    .option("--api-url <url>", "PaperAI API base URL")
    .option("--token <token>", "PaperAI auth token")
    .action(async (challengeId: string, options) => {
      const client = await context.createApiClient({
        apiUrl: options.apiUrl,
        token: options.token,
      });
      printJson(context.runtime, await client.approveCliAuthChallenge(challengeId, options.challengeToken));
    });
}
