import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { paperAiConfigSchema, type PaperAiConfig } from "@paperai/shared";

export interface ProfileConfig {
  apiUrl?: string;
  token?: string;
  defaultCompanyId?: string;
}

export const DEFAULT_API_URL = "http://localhost:3001/api/v1";

export function getPaperAiHomeDir(env: NodeJS.ProcessEnv): string {
  return path.resolve(env.PAPERAI_HOME ?? path.join(env.HOME ?? os.homedir(), ".paperai"));
}

export function getInstanceConfigPath(env: NodeJS.ProcessEnv): string {
  return path.resolve(env.PAPERAI_CONFIG ?? path.join(getPaperAiHomeDir(env), "config.json"));
}

export function getProfilePath(env: NodeJS.ProcessEnv): string {
  if (env.PAPERAI_PROFILE) {
    return path.resolve(env.PAPERAI_PROFILE);
  }

  return path.join(getPaperAiHomeDir(env), "profile.json");
}

function getLegacyProfilePath(env: NodeJS.ProcessEnv): string {
  const configRoot = env.XDG_CONFIG_HOME ?? path.join(env.HOME ?? os.homedir(), ".config");
  return path.join(configRoot, "papercli", "config.json");
}

export async function readProfileConfig(env: NodeJS.ProcessEnv): Promise<ProfileConfig> {
  const configPath = getProfilePath(env);

  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as ProfileConfig;
    return normalizeProfileConfig(parsed);
  } catch {
    try {
      const raw = await readFile(getLegacyProfilePath(env), "utf8");
      const parsed = JSON.parse(raw) as ProfileConfig;
      return normalizeProfileConfig(parsed);
    } catch {
      return {};
    }
  }
}

export async function writeProfileConfig(env: NodeJS.ProcessEnv, profile: ProfileConfig): Promise<string> {
  const configPath = getProfilePath(env);
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(normalizeProfileConfig(profile), null, 2)}\n`);
  return configPath;
}

export function normalizeProfileConfig(profile: ProfileConfig): ProfileConfig {
  const next: ProfileConfig = {};

  if (typeof profile.apiUrl === "string" && profile.apiUrl.length > 0) {
    next.apiUrl = profile.apiUrl;
  }

  if (typeof profile.token === "string" && profile.token.length > 0) {
    next.token = profile.token;
  }

  if (typeof profile.defaultCompanyId === "string" && profile.defaultCompanyId.length > 0) {
    next.defaultCompanyId = profile.defaultCompanyId;
  }

  return next;
}

export function deriveGatewayUrlFromServer(server: {
  host: string;
  port: number;
  webOrigin: string;
}): string {
  const protocol = (() => {
    try {
      return new URL(server.webOrigin).protocol;
    } catch {
      return "http:";
    }
  })();

  const normalizedHost = server.host === "0.0.0.0" ? "127.0.0.1" : server.host;
  return `${protocol}//${normalizedHost}:${server.port}/execute`;
}

export function defaultPaperAiConfig(env: NodeJS.ProcessEnv): PaperAiConfig {
  const homeDir = getPaperAiHomeDir(env);
  const server = {
    host: "127.0.0.1",
    port: 3001,
    webOrigin: "http://localhost:5173",
    jwtSecret: "change-me-paperai",
  } as const;

  return {
    version: 1,
    database: {
      mode: "embedded-postgres",
      embeddedDataDir: path.join(homeDir, "data", "postgres"),
      embeddedPort: 54329,
      backup: {
        dir: path.join(homeDir, "backups"),
      },
    },
    server: { ...server },
    gateway: {
      openclawUrl: deriveGatewayUrlFromServer(server),
    },
    auth: {
      boardClaimTtlMinutes: 30,
      cliChallengeTtlMinutes: 10,
      agentTokenTtlMinutes: 60,
    },
  };
}

export async function readInstanceConfig(env: NodeJS.ProcessEnv): Promise<PaperAiConfig | null> {
  const configPath = getInstanceConfigPath(env);

  try {
    const raw = await readFile(configPath, "utf8");
    return paperAiConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function writeInstanceConfig(env: NodeJS.ProcessEnv, config: PaperAiConfig): Promise<string> {
  const configPath = getInstanceConfigPath(env);
  await mkdir(path.dirname(configPath), { recursive: true });
  const normalized = paperAiConfigSchema.parse(config);
  await writeFile(configPath, `${JSON.stringify(normalized, null, 2)}\n`);
  return configPath;
}
