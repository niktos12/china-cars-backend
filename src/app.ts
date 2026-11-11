import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";

import { adminRouter } from "./routes/admin";
import { leadsRouter } from "./routes/leads";
import { productsRouter } from "./routes/products";

/**
 * CORS настроен:
 *  - CORS_ORIGIN не задан            -> разрешены все домены (access-control-allow-origin: *)
 *  - CORS_ORIGIN=https://a.ru,https://b.vercel.app -> только перечисленные домены.
 * Заголовки Authorization (Bearer-токен админки) и Content-Type разрешены явно,
 * preflight (OPTIONS) обрабатывается автоматически пакетом cors.
 */
function buildCorsOrigin() {
  const raw = (process.env.CORS_ORIGIN ?? "").trim();
  if (!raw) return true; // разрешить всем (удобно на старте)

  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : true;
}

const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: buildCorsOrigin(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // авторизация через Bearer-токен, cookies не нужны
    maxAge: 86400,
  }),
);
app.use(express.json({ limit: "32kb" }));

/* Health-check: GET /api/health */
app.get("/api/health", (_req, res) => {
  const dbConfigured = /^postgres(ql)?:\/\//.test(
    process.env.DATABASE_URL ?? "",
  );
  res.json({
    ok: true,
    service: "steelcraft-tuning-api",
    db: dbConfigured ? "configured" : "demo",
    admin: Boolean(
      process.env.ADMIN_USERNAME &&
        process.env.ADMIN_PASSWORD &&
        process.env.ADMIN_JWT_SECRET,
    ),
    time: new Date().toISOString(),
  });
});

app.use("/api/products", productsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/admin", adminRouter);

/* 404 — неизвестный путь */
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Маршрут не найден" });
});

/* Централизованный обработчик ошибок */
app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] Unhandled error:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Внутренняя ошибка сервера" });
  },
);

export default app;
