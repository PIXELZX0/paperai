import { CliError, toCliError } from "./errors.js";
import type { CliRuntime } from "./runtime.js";

export function printJson(runtime: CliRuntime, value: unknown) {
  runtime.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(runtime: CliRuntime, error: unknown): number {
  const cliError = toCliError(error);
  const lines = [cliError.message];

  if (cliError.details) {
    lines.push(cliError.details);
  }

  runtime.stderr.write(`${lines.join("\n")}\n`);
  return cliError.exitCode;
}

export function assertNever(message: string): never {
  throw new CliError(message);
}
