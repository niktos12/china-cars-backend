import "dotenv/config";

import { createApp } from "../src/app";

/**
 * Входная точка для Vercel (вариант «бэкенд отдельным проектом на Vercel»).
 * Vercel оборачивает этот Express-приложение в serverless-функцию:
 * все пути проекта переписываются на /api/index через vercel.json.
 *
 * Особенности serverless: холодный старт и подключения к БД — используйте
 * pooled-строку подключения (у Neon это хост с -pooler).
 */
const app = createApp();

export default app;
