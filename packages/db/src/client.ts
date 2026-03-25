import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";

export function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false,
  });

  return drizzle(client, {
    schema,
  });
}

export type Database = ReturnType<typeof createDatabase>;
