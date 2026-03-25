import { Writable, Readable } from "node:stream";

export interface CliRuntimeInput {
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
  stdin?: Readable & { isTTY?: boolean };
  stdout?: Writable;
  stderr?: Writable;
  invocationName?: string;
}

export interface CliRuntime {
  fetchImpl: typeof fetch;
  env: NodeJS.ProcessEnv;
  stdin: Readable & { isTTY?: boolean };
  stdout: Writable;
  stderr: Writable;
  invocationName: string;
}

export function resolveCliRuntime(input: CliRuntimeInput = {}): CliRuntime {
  return {
    fetchImpl: input.fetchImpl ?? fetch,
    env: input.env ?? process.env,
    stdin: input.stdin ?? process.stdin,
    stdout: input.stdout ?? process.stdout,
    stderr: input.stderr ?? process.stderr,
    invocationName: input.invocationName ?? "papercli",
  };
}
