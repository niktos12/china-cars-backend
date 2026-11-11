import app from "../src/app";

/**
 * Точка входа для Vercel Serverless Functions.
 * vercel.json направляет ВСЕ запросы (rewrite /(.*)) на эту функцию,
 * а внутри запросы маршрутизирует уже Express.
 *
 * VercelRequest/VercelResponse структурно совместимы с
 * express Request/Response, поэтому достаточно вызвать app(...).
 */
export default function handler(
  ...args: Parameters<typeof app>
): ReturnType<typeof app> {
  return app(...args);
}
