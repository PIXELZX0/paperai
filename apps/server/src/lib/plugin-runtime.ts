import { spawn } from "node:child_process";
import type { Plugin } from "@paperai/shared";

type RuntimeKind = "tool" | "job" | "webhook" | "health";

type HttpRuntimeConfig = {
  transport?: "http";
  baseUrl: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  uiBaseUrl?: string;
};

type CommandRuntimeConfig = {
  transport: "command";
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  uiBaseUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, item]) => [key, item]),
  );
}

function getHttpConfig(config: Record<string, unknown>): HttpRuntimeConfig | null {
  if (typeof config.baseUrl !== "string" || config.baseUrl.length === 0) {
    return null;
  }

  return {
    transport: config.transport === "http" ? "http" : undefined,
    baseUrl: config.baseUrl.replace(/\/$/, ""),
    headers: asStringRecord(config.headers),
    timeoutMs: typeof config.timeoutMs === "number" ? config.timeoutMs : undefined,
    uiBaseUrl: typeof config.uiBaseUrl === "string" ? config.uiBaseUrl : undefined,
  };
}

function getCommandConfig(config: Record<string, unknown>): CommandRuntimeConfig | null {
  if (config.transport !== "command" || typeof config.command !== "string" || config.command.length === 0) {
    return null;
  }

  return {
    transport: "command",
    command: config.command,
    args: Array.isArray(config.args) ? config.args.filter((item): item is string => typeof item === "string") : [],
    cwd: typeof config.cwd === "string" ? config.cwd : undefined,
    env: asStringRecord(config.env),
    timeoutMs: typeof config.timeoutMs === "number" ? config.timeoutMs : undefined,
    uiBaseUrl: typeof config.uiBaseUrl === "string" ? config.uiBaseUrl : undefined,
  };
}

function tryParseJson(input: string) {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function buildHttpPath(kind: RuntimeKind, key?: string) {
  if (kind === "health") {
    return "/health";
  }
  if (!key) {
    throw new Error("plugin_runtime_key_required");
  }
  return `/${kind === "tool" ? "tools" : kind === "job" ? "jobs" : "webhooks"}/${encodeURIComponent(key)}`;
}

async function executeHttpRuntime(
  plugin: Plugin,
  config: HttpRuntimeConfig,
  kind: RuntimeKind,
  key: string | undefined,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${config.baseUrl}${buildHttpPath(kind, key)}`, {
    method: kind === "health" ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...config.headers,
    },
    body:
      kind === "health"
        ? undefined
        : JSON.stringify({
            pluginId: plugin.id,
            pluginSlug: plugin.slug,
            kind,
            key,
            payload,
          }),
    signal: AbortSignal.timeout(config.timeoutMs ?? 5_000),
  });

  const text = await response.text();
  const parsed = text.length > 0 ? tryParseJson(text) : null;
  const result = isRecord(parsed) ? parsed : text.length > 0 ? { raw: text } : {};

  return {
    ok: response.ok,
    result: {
      transport: "http",
      status: response.status,
      ...result,
    },
  };
}

async function executeCommandRuntime(
  plugin: Plugin,
  config: CommandRuntimeConfig,
  kind: RuntimeKind,
  key: string | undefined,
  payload: Record<string, unknown>,
) {
  const child = spawn(config.command, config.args ?? [], {
    cwd: config.cwd,
    env: {
      ...process.env,
      ...config.env,
      PAPERAI_PLUGIN_ID: plugin.id,
      PAPERAI_PLUGIN_SLUG: plugin.slug,
      PAPERAI_PLUGIN_KIND: kind,
      PAPERAI_PLUGIN_KEY: key ?? "",
    },
    stdio: "pipe",
  });

  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, config.timeoutMs ?? 5_000);

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.stdin.write(
    JSON.stringify({
      pluginId: plugin.id,
      pluginSlug: plugin.slug,
      kind,
      key,
      payload,
    }),
  );
  child.stdin.end();

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  }).finally(() => clearTimeout(timeout));

  const parsed = stdout.trim().length > 0 ? tryParseJson(stdout.trim()) : null;

  return {
    ok: exitCode === 0,
    result: {
      transport: "command",
      exitCode,
      stdout: isRecord(parsed) ? undefined : stdout.trim() || undefined,
      stderr: stderr.trim() || undefined,
      ...(isRecord(parsed) ? parsed : {}),
    },
  };
}

export async function executePluginRuntime(
  plugin: Plugin,
  resolvedConfig: Record<string, unknown>,
  kind: RuntimeKind,
  key: string | undefined,
  payload: Record<string, unknown>,
) {
  const commandConfig = getCommandConfig(resolvedConfig);
  if (commandConfig) {
    return await executeCommandRuntime(plugin, commandConfig, kind, key, payload);
  }

  const httpConfig = getHttpConfig(resolvedConfig);
  if (httpConfig) {
    return await executeHttpRuntime(plugin, httpConfig, kind, key, payload);
  }

  return {
    ok: false,
    result: {
      transport: "none",
      message: "Plugin runtime is not configured. Set `baseUrl` or `{ transport: \"command\", command: ... }` in plugin config.",
    },
  };
}

export function getPluginUiBridgeMount(plugin: Plugin, resolvedConfig: Record<string, unknown>) {
  const commandConfig = getCommandConfig(resolvedConfig);
  if (commandConfig?.uiBaseUrl) {
    return commandConfig.uiBaseUrl;
  }

  const httpConfig = getHttpConfig(resolvedConfig);
  if (httpConfig?.uiBaseUrl) {
    return httpConfig.uiBaseUrl;
  }

  if (httpConfig?.baseUrl) {
    return `${httpConfig.baseUrl}/ui`;
  }

  return null;
}
