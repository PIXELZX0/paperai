import { spawn, type ChildProcess } from "node:child_process";
import process from "node:process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function parsePort(
  rawValue: string | undefined,
  fallback: number,
  label: string,
) {
  const value = Number(rawValue ?? fallback);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeConnectHost(host: string) {
  return host === "0.0.0.0" ? "127.0.0.1" : host;
}

function startProcess(
  name: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  onExit: (code: number | null, signal: NodeJS.Signals | null) => void,
) {
  const child = spawn(pnpm, args, {
    env,
    stdio: "inherit",
  });

  child.on("exit", onExit);
  child.on("error", (error) => {
    console.error(`[${name}] ${error.message}`);
    onExit(1, null);
  });

  return child;
}

const host = process.env.HOST ?? "127.0.0.1";
const publicPort = parsePort(
  process.env.PAPERAI_WEB_PORT ?? process.env.PAPERAI_PORT ?? process.env.PORT,
  3001,
  "PAPERAI_WEB_PORT",
);
const apiPort = parsePort(
  process.env.PAPERAI_API_PORT ?? process.env.PAPERAI_INTERNAL_API_PORT,
  publicPort + 1,
  "PAPERAI_API_PORT",
);

if (apiPort === publicPort) {
  throw new Error(
    "pnpm dev needs a separate internal API port behind the shared web/API port. Set PAPERAI_API_PORT to a different port.",
  );
}

const apiHost = normalizeConnectHost(host);
const publicHost = normalizeConnectHost(
  process.env.PAPERAI_PUBLIC_HOST ?? host,
);
const webOrigin =
  process.env.PAPERAI_WEB_ORIGIN ?? `http://${publicHost}:${publicPort}`;
const children: ChildProcess[] = [];
let shuttingDown = false;

function shutdown(exitCode: number) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }

  process.exit(exitCode);
}

console.log(`PaperAI dev UI/API: http://${publicHost}:${publicPort}`);
console.log(`PaperAI internal API: http://${apiHost}:${apiPort}`);

children.push(
  startProcess(
    "server",
    ["--filter", "@paperai/server", "dev"],
    {
      ...process.env,
      HOST: host,
      PORT: String(apiPort),
      PAPERAI_WEB_ORIGIN: webOrigin,
    },
    (code, signal) => {
      if (!shuttingDown) {
        console.error(
          `[server] exited${signal ? ` from ${signal}` : ""} with code ${code ?? 0}`,
        );
        shutdown(code ?? 1);
      }
    },
  ),
);

children.push(
  startProcess(
    "web",
    ["--filter", "@paperai/web", "dev"],
    {
      ...process.env,
      HOST: host,
      PAPERAI_WEB_HOST: host,
      PAPERAI_WEB_PORT: String(publicPort),
      PAPERAI_API_HOST: apiHost,
      PAPERAI_API_PORT: String(apiPort),
    },
    (code, signal) => {
      if (!shuttingDown) {
        console.error(
          `[web] exited${signal ? ` from ${signal}` : ""} with code ${code ?? 0}`,
        );
        shutdown(code ?? 1);
      }
    },
  ),
);

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));
