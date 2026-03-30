# Hermes Adapter

PaperAI exposes `hermes` as a first-class adapter type for local Hermes CLI execution.

## Purpose

Use `hermes` when an agent should run through the local [Hermes Agent CLI](https://hermes-agent.nousresearch.com/).

## Configuration

- Adapter type: `hermes`
- Default command: `hermes`
- Default subcommand: `chat`
- Default toolsets: `terminal,file,web,skills`
- Session support: disabled for now

## Supported `adapterConfig` keys

- `command`: override the CLI executable path
- `subcommand`: override the Hermes subcommand, defaults to `chat`
- `provider`: pass `--provider`
- `model`: pass `--model`
- `toolsets`: string or string array, passed to `--toolsets`
- `worktree`: when `true`, passes `--worktree`
- `continue`: when `true`, passes `--continue`
- `resume`: passes `--resume <value>`
- `verbose`: when `true`, passes `--verbose`
- `args`: additional CLI args appended before the prompt

## Notes

- PaperAI currently invokes Hermes in single-query mode with `-q`.
- The adapter forwards the compiled PaperAI execution instructions as the Hermes query text.
- Hermes session persistence is not wired into PaperAI yet, so repeated heartbeats are treated as independent runs by default.
