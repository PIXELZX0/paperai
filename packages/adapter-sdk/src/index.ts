import { spawn } from "node:child_process";
import type {
  AdapterDefinition,
  AdapterDiagnostic,
  AdapterExecutionContext,
  AdapterExecutionResult,
  TranscriptEntry,
} from "@paperai/shared";

export type CommandBuilder = (context: AdapterExecutionContext) => {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
};

export interface LocalAdapterOptions {
  type: AdapterDefinition["type"];
  label: string;
  description: string;
  supportsSessions?: boolean;
  buildCommand: CommandBuilder;
}

export interface HttpAdapterOptions {
  type: AdapterDefinition["type"];
  label: string;
  description: string;
  endpoint: string;
  supportsSessions?: boolean;
}

export async function runCommand(
  context: AdapterExecutionContext,
  build: CommandBuilder,
): Promise<AdapterExecutionResult> {
  const { command, args = [], env = {}, cwd } = build(context);

  return await new Promise((resolve) => {
    const transcript: TranscriptEntry[] = [];
    let stdout = "";
    let stderr = "";

    const child = spawn(command, args, {
      cwd: cwd ?? context.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...context.env,
        ...env,
      },
      shell: true,
    });

    child.stdout.on("data", (chunk) => {
      const message = chunk.toString();
      stdout += message;
      transcript.push({ type: "stdout", message, at: new Date().toISOString() });
    });

    child.stderr.on("data", (chunk) => {
      const message = chunk.toString();
      stderr += message;
      transcript.push({ type: "stderr", message, at: new Date().toISOString() });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        exitCode: code ?? 1,
        error: code === 0 ? undefined : stderr || stdout || "process_failed",
        clearSession: /SESSION_EXPIRED|UNKNOWN_SESSION/i.test(stderr) || /SESSION_EXPIRED|UNKNOWN_SESSION/i.test(stdout),
        transcript,
        session: context.session,
        result: {
          stdout,
          stderr,
        },
      });
    });
  });
}

export function createLocalAdapter(options: LocalAdapterOptions): AdapterDefinition {
  return {
    type: options.type,
    label: options.label,
    description: options.description,
    supportsSessions: options.supportsSessions ?? true,
    async validateConfig() {
      const diagnostics: AdapterDiagnostic[] = [
        { level: "info", message: `${options.label} uses local process execution.` },
      ];
      return diagnostics;
    },
    async execute(context) {
      const first = await runCommand(context, options.buildCommand);
      if (first.clearSession) {
        return await runCommand({ ...context, session: null }, options.buildCommand);
      }
      return first;
    },
  };
}

export function createHttpAdapter(options: HttpAdapterOptions): AdapterDefinition {
  return {
    type: options.type,
    label: options.label,
    description: options.description,
    supportsSessions: options.supportsSessions ?? true,
    async validateConfig(config) {
      const diagnostics: AdapterDiagnostic[] = [];
      if (!("apiKey" in config) && !("headers" in config)) {
        diagnostics.push({ level: "warn", message: "HTTP adapter is configured without auth headers." });
      }
      diagnostics.push({ level: "info", message: `HTTP adapter target: ${options.endpoint}` });
      return diagnostics;
    },
    async execute(context) {
      const response = await fetch(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(context),
      });

      const json = (await response.json()) as AdapterExecutionResult;
      if (json.clearSession) {
        return await this.execute({ ...context, session: null });
      }
      return json;
    },
  };
}
