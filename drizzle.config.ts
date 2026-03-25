import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config();

export default defineConfig({
  schema: "./packages/db/src/schema/index.ts",
  out: "./packages/db/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/paperai",
  },
});
