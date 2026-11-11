import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { adminRouter } from "./routes/admin";
import { publicRouter } from "./routes/public";

/**
 * Фабрика Express-приложения. Вынесена отдельно от server.ts, чтобы
 * один и тот же код работал:
 *  - как обычный долгоживущий сервер (npm start / Railway);
 *  - как serverless-функция на Vercel (api/index.ts).
 */
export function createApp(): express.Express {
  const app = express();

  // За обратным прокси (Railway/Vercel/Next.js) корректно определяем https
  app.set("trust proxy", 1);

  // CORS нужен только для ПРЯМЫХ запросов к API из других источников
  // (мобильное приложение, тесты и т.п.). Сайт ходит через same-origin
  // прокси Next.js, ему CORS не требуется.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim())
    : true;
  app.use(cors({ origin: corsOrigin, credentials: false }));

  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());

  app.use("/api", publicRouter);
  app.use("/api/admin", adminRouter);

  // 404 для неизвестных путей
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Не найдено" });
  });

  // Централизованный обработчик ошибок
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] Ошибка обработки запроса:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  });

  return app;
}
