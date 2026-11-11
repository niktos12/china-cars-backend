import "dotenv/config";

import { isDbConfigured } from "./db";
import { createApp } from "./app";

/**
 * Точка входа: обычный долгоживущий Node.js-сервер.
 * Локально:  npm run dev      → http://localhost:4000
 * Railway:   npm run build && npm start (PORT подставляет платформа)
 */
const app = createApp();
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  const mode = isDbConfigured ? "PostgreSQL" : "DEMO (без БД)";
  console.log(`[api] Express запущен: http://localhost:${port} · режим: ${mode}`);
});
