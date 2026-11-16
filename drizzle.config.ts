import "dotenv/config";

import { defineConfig } from "drizzle-kit";

/**
 * ВАЖНО: переменные читаются из файла .env в корне репо.
 * Файл .env.example — это только шаблон, dotenv его НЕ загружает.
 *
 * Как создать .env:
 *   Windows (cmd):      copy .env.example .env
 *   Windows (PowerShell): Copy-Item .env.example .env
 *   macOS / Linux:      cp .env.example .env
 */
const url = process.env.DATABASE_URL;

if (!url || !/^postgres(ql)?:\/\//.test(url)) {
  console.error(
    [
      "",
      "══════════════════════════════════════════════════════════════",
      "  DATABASE_URL не задан или не похож на строку Postgres.",
      "══════════════════════════════════════════════════════════════",
      "",
      "Как исправить:",
      "  1) Создайте файл .env в корне репо (dotenv читает только его):",
      "       Windows cmd:  copy .env.example .env",
      "       PowerShell:   Copy-Item .env.example .env",
      "  2) Впишите в .env реальную строку подключения из Neon",
      "     (pooled-строка, хост содержит -pooler, в конце ?sslmode=require):",
      "       DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require",
      "  3) Запустите команду снова: npm run db:migrate",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
