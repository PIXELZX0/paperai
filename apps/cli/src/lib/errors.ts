export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
    readonly details?: string,
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function toCliError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (error instanceof Error) {
    return new CliError(error.message);
  }

  return new CliError("Unknown CLI error");
}
