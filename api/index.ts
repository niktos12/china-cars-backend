import app from "../src/app";

/**
 * Точка входа для Vercel Serverless Functions.
 * vercel.json направляет ВСЕ запросы (rewrite /(.*)) на эту функцию,
 * а внутри запросы маршрутизирует уже Express.
 *
 * Важно: здесь НЕТ app.listen() — в serverless Vercel сам управляет
 * HTTP-соединением и передаёт req/res в обработчик. listen() внутри
 * функции — самая частая причина ошибки FUNCTION_INVOCATION_FAILED.
 */
export default function handler(
  ...args: Parameters<typeof app>
): ReturnType<typeof app> {
  try {
    return app(...args);
  } catch (err) {
    // Видно в Vercel Dashboard -> Deployments -> Runtime Logs
    console.error("[api/index] Handler error:", err);
    throw err;
  }
}
