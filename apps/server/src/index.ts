import type { Server } from "node:http";
import { createApp } from "./app.js";
import { getConfig } from "./config.js";

export interface StartedServer {
  server: Server;
  host: string;
  listenPort: number;
  apiUrl: string;
  databaseUrl: string;
}

export async function startServer(): Promise<StartedServer> {
  const config = getConfig();
  const app = await createApp({ config });
  const address = await app.listen({
    port: config.port,
    host: config.host,
  });

  const listenUrl = typeof address === "string" ? new URL(address) : new URL(`http://${config.host}:${config.port}`);
  const resolvedHost = listenUrl.hostname === "0.0.0.0" ? "127.0.0.1" : listenUrl.hostname;

  return {
    server: app.server,
    host: resolvedHost,
    listenPort: Number(listenUrl.port || config.port),
    apiUrl: `http://${resolvedHost}:${listenUrl.port || config.port}/api/v1`,
    databaseUrl: config.databaseUrl,
  };
}

async function main() {
  await startServer();
}

const invokedScript = process.argv[1] ?? "";
if (invokedScript.endsWith("/index.ts") || invokedScript.endsWith("/index.js")) {
  void main();
}
