import { readFile } from "node:fs/promises";
import { CliError } from "./errors.js";
import type { CliRuntime } from "./runtime.js";

export interface BodyInputOptions {
  body?: string;
  bodyFile?: string;
}

export async function readBodyInput(
  runtime: CliRuntime,
  options: BodyInputOptions,
  required = false,
): Promise<string | undefined> {
  if (typeof options.body === "string") {
    return options.body;
  }

  if (typeof options.bodyFile === "string") {
    return (await readFile(options.bodyFile, "utf8")).trimEnd();
  }

  if (runtime.stdin.isTTY !== true) {
    let piped = "";

    for await (const chunk of runtime.stdin) {
      piped += chunk.toString();
    }

    const value = piped.trimEnd();
    if (value.length > 0) {
      return value;
    }
  }

  if (required) {
    throw new CliError("Body input is required. Pass `--body`, `--body-file`, or pipe text on stdin.");
  }

  return undefined;
}

export function parseJsonObject(input: string | undefined, label: string): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("object_expected");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new CliError(`Invalid ${label} JSON.`);
  }
}
