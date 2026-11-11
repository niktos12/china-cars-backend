import app from "./app";
import { isDbConfigured } from "./db";

/** Локальный запуск: npm run dev (tsx watch) или npm run build && npm start */
const port = Number(process.env.PORT ?? 3001);

app.listen(port, () => {
  console.log(`steelcraft-tuning-api слушает http://localhost:${port}`);
  console.log(
    `  DB: ${isDbConfigured ? "подключена" : "НЕ задана или не postgres:// (демо-режим)"}`,
  );
  console.log(`  CORS_ORIGIN: ${process.env.CORS_ORIGIN || "* (все домены)"}`);
});
