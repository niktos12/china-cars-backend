import app from "./app";
import { isDbConfigured } from "./db";
import { logEnvStatus } from "./env";

/**
 * Локальный запуск: npm run dev (tsx watch) или npm run build && npm start.
 *
 * ВАЖНО: на Vercel исполнителем является api/index.ts (без listen()).
 * Если Vercel вдруг определит проект как "backend framework" и возьмёт
 * этот файл как точку входа, app.listen() в serverless приведёт к
 * FUNCTION_INVOCATION_FAILED — поэтому слушаем порт только вне Vercel.
 */
const port = Number(process.env.PORT ?? 3001);

function bootstrap() {
  logEnvStatus(); // сразу видно, найден ли .env и заданы ли ADMIN_*
  app.listen(port, () => {
    console.log(`steelcraft-tuning-api слушает http://localhost:${port}`);
    console.log(
      `  DB: ${isDbConfigured ? "подключена" : "НЕ задана или не postgres:// (демо-режим)"}`,
    );
    console.log(`  CORS_ORIGIN: ${process.env.CORS_ORIGIN || "* (все домены)"}`);
  });
}

if (process.env.VERCEL) {
  console.log("[index] Запущено на Vercel — listen() пропущен (см. api/index.ts)");
} else {
  bootstrap();
}
