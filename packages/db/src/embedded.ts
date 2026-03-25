import { existsSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import postgres from "postgres";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

export interface EmbeddedPostgresHandle {
  adminConnectionString: string;
  connectionString: string;
  dataDir: string;
  port: number;
  started: boolean;
  stop(): Promise<void>;
}

export interface EnsureEmbeddedPostgresOptions {
  dataDir: string;
  preferredPort: number;
  databaseName?: string;
  user?: string;
  password?: string;
  onLog?: (message: string) => void;
}

async function getEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const mod = await import("embedded-postgres");
  return mod.default as EmbeddedPostgresCtor;
}

async function canConnect(connectionString: string): Promise<boolean> {
  const sql = postgres(connectionString, {
    max: 1,
    connect_timeout: 2,
    idle_timeout: 2,
    prepare: false,
    onnotice: () => {},
  });

  try {
    await sql`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate port")));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

export async function ensurePostgresDatabase(adminConnectionString: string, databaseName: string): Promise<void> {
  const sql = postgres(adminConnectionString, {
    max: 1,
    prepare: false,
    onnotice: () => {},
  });

  try {
    const rows = await sql<{ exists: boolean }[]>`
      select exists(select 1 from pg_database where datname = ${databaseName}) as exists
    `;
    if (!rows[0]?.exists) {
      await sql.unsafe(`create database "${databaseName.replaceAll(`"`, `""`)}"`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function ensureEmbeddedPostgres(
  input: EnsureEmbeddedPostgresOptions,
): Promise<EmbeddedPostgresHandle> {
  const user = input.user ?? "paperai";
  const password = input.password ?? "paperai";
  const databaseName = input.databaseName ?? "paperai";
  const dataDir = path.resolve(input.dataDir);
  const preferredPort = input.preferredPort;
  const log = input.onLog ?? (() => {});

  const preferredAdminUrl = `postgres://${user}:${password}@127.0.0.1:${preferredPort}/postgres`;
  if (await canConnect(preferredAdminUrl)) {
    await ensurePostgresDatabase(preferredAdminUrl, databaseName);
    return {
      adminConnectionString: preferredAdminUrl,
      connectionString: `postgres://${user}:${password}@127.0.0.1:${preferredPort}/${databaseName}`,
      dataDir,
      port: preferredPort,
      started: false,
      async stop() {},
    };
  }

  let port = preferredPort;
  if (!(await isPortAvailable(port))) {
    port = await getAvailablePort();
    log(`Embedded PostgreSQL port ${preferredPort} is busy; using ${port} instead.`);
  }

  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: (message) => log(String(message ?? "")),
    onError: (message) => log(String(message ?? "")),
  });

  const versionFile = path.join(dataDir, "PG_VERSION");
  if (!existsSync(versionFile)) {
    await instance.initialise();
  }

  const pidFile = path.join(dataDir, "postmaster.pid");
  if (existsSync(pidFile)) {
    rmSync(pidFile, { force: true });
  }

  await instance.start();

  const adminConnectionString = `postgres://${user}:${password}@127.0.0.1:${port}/postgres`;
  await ensurePostgresDatabase(adminConnectionString, databaseName);

  return {
    adminConnectionString,
    connectionString: `postgres://${user}:${password}@127.0.0.1:${port}/${databaseName}`,
    dataDir,
    port,
    started: true,
    async stop() {
      await instance.stop();
    },
  };
}
