import { config } from "dotenv";

config();

export interface ServerConfig {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  webOrigin: string;
}

export function getConfig(): ServerConfig {
  return {
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/paperai",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    webOrigin: process.env.PAPERAI_WEB_ORIGIN ?? "http://localhost:5173",
  };
}
