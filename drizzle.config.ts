import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Миграции живут внутри server/ — бэкенд единолично владеет схемой БД.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: false,
});
