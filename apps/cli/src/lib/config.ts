import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export interface ProfileConfig {
  apiUrl?: string;
  token?: string;
  defaultCompanyId?: string;
}

export const DEFAULT_API_URL = "http://localhost:3001/api/v1";

export function getProfilePath(env: NodeJS.ProcessEnv): string {
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
    return {};
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
