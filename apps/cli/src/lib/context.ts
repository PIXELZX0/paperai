import { CliError } from "./errors.js";
import {
  DEFAULT_API_URL,
  type ProfileConfig,
  readInstanceConfig,
  readProfileConfig,
  writeProfileConfig,
} from "./config.js";
import { PaperAiApiClient } from "./api.js";
import type { CliRuntime } from "./runtime.js";

export interface CommandContext {
  runtime: CliRuntime;
  loadProfile(): Promise<ProfileConfig>;
  saveProfile(profile: ProfileConfig): Promise<string>;
  resolveApiUrl(option?: string): Promise<string>;
  resolveToken(option?: string, required?: boolean): Promise<string | null>;
  resolveCompanyId(option?: string, required?: boolean): Promise<string | null>;
  resolveAgentId(option?: string, required?: boolean): string | null;
  resolveTaskId(option?: string, required?: boolean): string | null;
  resolveIssueId(option?: string, required?: boolean): string | null;
  createApiClient(input?: {
    apiUrl?: string;
    token?: string;
    requireToken?: boolean;
  }): Promise<PaperAiApiClient>;
}

export function createCommandContext(runtime: CliRuntime): CommandContext {
  let cachedProfile: ProfileConfig | null = null;

  async function loadProfile() {
    if (cachedProfile) {
      return cachedProfile;
    }

    cachedProfile = await readProfileConfig(runtime.env);
    return cachedProfile;
  }

  return {
    runtime,
    loadProfile,
    async saveProfile(profile) {
      cachedProfile = profile;
      return await writeProfileConfig(runtime.env, profile);
    },
    async resolveApiUrl(option) {
      if (option) {
        return option;
      }

      if (runtime.env.PAPERAI_API_URL) {
        return runtime.env.PAPERAI_API_URL;
      }

      const profile = await loadProfile();
      if (profile.apiUrl) {
        return profile.apiUrl;
      }

      const config = await readInstanceConfig(runtime.env);
      if (config) {
        const host = config.server.host === "0.0.0.0" ? "127.0.0.1" : config.server.host;
        return `http://${host}:${config.server.port}/api/v1`;
      }

      return DEFAULT_API_URL;
    },
    async resolveToken(option, required = true) {
      const token = option ?? runtime.env.PAPERAI_TOKEN ?? (await loadProfile()).token ?? null;
      if (required && !token) {
        throw new CliError("Authentication token is required. Run `papercli auth login` or set `PAPERAI_TOKEN`.");
      }
      return token;
    },
    async resolveCompanyId(option, required = true) {
      const companyId = option ?? runtime.env.PAPERAI_COMPANY_ID ?? (await loadProfile()).defaultCompanyId ?? null;
      if (required && !companyId) {
        throw new CliError(
          "Company ID is required. Pass `--company`, set `PAPERAI_COMPANY_ID`, or run `papercli company use <companyId>`.",
        );
      }
      return companyId;
    },
    resolveAgentId(option, required = true) {
      const agentId = option ?? runtime.env.PAPERAI_AGENT_ID ?? null;
      if (required && !agentId) {
        throw new CliError("Agent ID is required. Pass `--agent` or set `PAPERAI_AGENT_ID`.");
      }
      return agentId;
    },
    resolveTaskId(option, required = true) {
      const taskId = option ?? runtime.env.PAPERAI_TASK_ID ?? null;
      if (required && !taskId) {
        throw new CliError("Task ID is required. Pass it explicitly or set `PAPERAI_TASK_ID`.");
      }
      return taskId;
    },
    resolveIssueId(option, required = true) {
      const issueId = option ?? runtime.env.PAPERAI_ISSUE_ID ?? runtime.env.PAPERAI_TASK_ID ?? null;
      if (required && !issueId) {
        throw new CliError("Issue ID is required. Pass it explicitly or set `PAPERAI_TASK_ID`.");
      }
      return issueId;
    },
    async createApiClient(input = {}) {
      const apiUrl = await this.resolveApiUrl(input.apiUrl);
      const token = await this.resolveToken(input.token, input.requireToken ?? true);
      return new PaperAiApiClient(apiUrl, runtime.fetchImpl, token);
    },
  };
}
