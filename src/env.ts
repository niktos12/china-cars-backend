/**
 * Загрузка .env для ЛОКАЛЬНОГО запуска (npm run dev / npm start).
 *
 * Проблема, которую решает файл: раньше dotenv подключался только в
 * scripts/seed.ts и drizzle.config.ts, а сам API .env НЕ читал. В итоге
 * ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_JWT_SECRET были пусты, и
 * POST /api/admin/login отвечал 503 «Админка не настроена: задайте ... в
 * Variables» — хотя .env существовал и всё в нём было заполнено.
 *
 * Где ищем .env (загружаются ОБА файла; реальные переменные окружения
 * всегда важнее файла — override: false, файл не перезапишет то, что уже
 * задано в системе):
 *   1. <cwd>/.env      — server/.env (стандарт: npm run dev идёт из server/)
 *   2. <cwd>/../.env   — .env в корне репо, рядом с фронтендом (частая
 *                        ошибка «положил .env не туда» — теперь тоже работает)
 *
 * На Vercel .env-файла в бандле нет: оба вызова просто ничего не находят,
 * переменные приходят из Settings -> Environment Variables. Подключение
 * модуля безопасно в любом окружении.
 *
 * ВАЖНО: этот модуль импортируется ПЕРВЫМ в src/app.ts — до cors, express
 * и роутов, чтобы переменные были готовы к моменту чтения их в модулях
 * (например, isDbConfigured в src/db/index.ts вычисляется при импорте).
 */
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

/** Имена переменных, без которых /api/admin/login отвечает 503. */
export const ADMIN_ENV_KEYS = [
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_JWT_SECRET",
] as const;

/**
 * Диагностика при старте (вызывается из bootstrap() в src/index.ts):
 * сразу видно, что сервер не нашёл .env или что имена переменных в файле
 * не совпадают с ожидаемыми. На Vercel лог не печатаем — там всё из
 * Environment Variables и отсутствие .env нормально.
 */
export function logEnvStatus(): void {
  if (process.env.VERCEL) return;

  const missing = ADMIN_ENV_KEYS.filter((name) => !process.env[name]);
  if (missing.length === 0) {
    console.log(
      `[env] Админка настроена: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_JWT_SECRET заданы.`,
    );
    return;
  }

  console.warn(
    [
      `[env] Не заданы переменные: ${missing.join(", ")}`,
      `      Логин в админку ответит 503 «Админка не настроена», пока их нет.`,
      `      Что проверить:`,
      `        1) Файл .env лежит в server/ ИЛИ в корне репо (оба варианта`,
      `           читаются автоматически; имя файла — именно .env, не .env.txt).`,
      `        2) Имена совпадают с ожидаемыми: ADMIN_USERNAME (не ADMIN_LOGIN),`,
      `           ADMIN_PASSWORD, ADMIN_JWT_SECRET (не JWT_SECRET).`,
      `        3) Шаблон — server/.env.example.`,
    ].join("\n"),
  );
}
