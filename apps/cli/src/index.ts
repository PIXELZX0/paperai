#!/usr/bin/env node
import path from "node:path";
import { Command, CommanderError } from "commander";
import { createCommandContext } from "./lib/context.js";
import { printError } from "./lib/output.js";
import { resolveCliRuntime, type CliRuntimeInput } from "./lib/runtime.js";
import { registerAgentCommands } from "./commands/agent.js";
import { registerApprovalCommands } from "./commands/approval.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerCompanyCommands } from "./commands/company.js";
import { registerConfigureCommands } from "./commands/configure.js";
import { registerDbBackupCommands } from "./commands/db-backup.js";
import { registerDoctorCommands } from "./commands/doctor.js";
import { registerIssueCommands } from "./commands/issue.js";
import { registerLegacyCommands } from "./commands/legacy.js";
import { registerOnboardCommands } from "./commands/onboard.js";
import { registerPackageCommands } from "./commands/package.js";
import { registerPluginCommands } from "./commands/plugin.js";
import { registerRunCommands } from "./commands/run.js";
import { registerSecretCommands } from "./commands/secret.js";
import { registerSkillCommands } from "./commands/skill.js";
import { registerTaskCommands } from "./commands/task.js";
import { registerWorkspaceCommands } from "./commands/workspace.js";

function resolveInvocationName(explicitName?: string) {
  if (explicitName) {
    return explicitName;
  }

  const executed = process.argv[1] ? path.basename(process.argv[1]) : "";
  return executed === "paperai" ? "paperai" : "papercli";
}

export function buildProgram(input: CliRuntimeInput = {}) {
  const runtime = resolveCliRuntime({
    ...input,
    invocationName: resolveInvocationName(input.invocationName),
  });
  const context = createCommandContext(runtime);
  const program = new Command();

  program
    .name(runtime.invocationName)
    .description("Agent-first CLI for the PaperAI control plane")
    .showHelpAfterError()
    .showSuggestionAfterError()
    .configureOutput({
      writeOut: (value) => {
        runtime.stdout.write(value);
      },
      writeErr: (value) => {
        runtime.stderr.write(value);
      },
    })
    .exitOverride();

  registerAuthCommands(program, context);
  registerOnboardCommands(program, context);
  registerConfigureCommands(program, context);
  registerDoctorCommands(program, context);
  registerRunCommands(program, context);
  registerDbBackupCommands(program, context);
  registerCompanyCommands(program, context);
  registerWorkspaceCommands(program, context);
  registerSkillCommands(program, context);
  registerSecretCommands(program, context);
  registerAgentCommands(program, context);
  registerTaskCommands(program, context);
  registerIssueCommands(program, context);
  registerApprovalCommands(program, context);
  registerPackageCommands(program, context);
  registerPluginCommands(program, context);
  registerLegacyCommands(program, context);

  return program;
}

export async function runCli(argv = process.argv.slice(2), input: CliRuntimeInput = {}) {
  const runtime = resolveCliRuntime({
    ...input,
    invocationName: resolveInvocationName(input.invocationName),
  });
  const program = buildProgram(runtime);

  try {
    await program.parseAsync(argv, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      if (error.code === "commander.helpDisplayed" || error.code === "commander.version") {
        return 0;
      }
      return error.exitCode;
    }

    return printError(runtime, error);
  }
}

async function main() {
  const exitCode = await runCli(process.argv.slice(2), {
    invocationName: resolveInvocationName(),
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}

const invokedScript = process.argv[1] ? path.basename(process.argv[1]) : "";
const isMainModule = invokedScript === "papercli" || invokedScript === "paperai" || invokedScript.startsWith("index.");

if (isMainModule) {
  void main();
}
