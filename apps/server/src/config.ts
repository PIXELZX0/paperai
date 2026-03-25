import { config } from "dotenv";

config();

export interface ServerConfig {
  host: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  webOrigin: string;
  auth: {
    boardClaimTtlMinutes: number;
    cliChallengeTtlMinutes: number;
    agentTokenTtlMinutes: number;
  };
}

export function getConfig(): ServerConfig {
  return {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3001),
    databaseUrl: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/paperai",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    webOrigin: process.env.PAPERAI_WEB_ORIGIN ?? "http://localhost:5173",
    auth: {
      boardClaimTtlMinutes: Number(process.env.BOARD_CLAIM_TTL_MINUTES ?? 30),
      cliChallengeTtlMinutes: Number(process.env.CLI_CHALLENGE_TTL_MINUTES ?? 10),
      agentTokenTtlMinutes: Number(process.env.AGENT_TOKEN_TTL_MINUTES ?? 60),
    },
  };
}
