import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Подключение к Postgres через postgres.js.
 * prepare: false обязателен для serverless (Vercel) — pgbouncer/Neon pooled.
 */
export const isDbConfigured = /^postgres(ql)?:\/\//.test(
  process.env.DATABASE_URL ?? "",
);

let client: ReturnType<typeof postgres> | null = null;

export function getDb() {
  if (!isDbConfigured) return null;
  if (!client) {
    client = postgres(process.env.DATABASE_URL as string, {
      prepare: false,
      max: 5,
    });
  }
  return drizzle(client, { schema });
}

export { schema };
