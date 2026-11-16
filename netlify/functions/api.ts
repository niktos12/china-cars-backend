import serverlessHttp from "serverless-http";

import app from "../../src/app";

/**
 * Точка входа для Netlify Functions.
 * netlify.toml перенаправляет все запросы /api/* на эту функцию,
 * а serverless-http превращает Lambda-событие Netlify в Node req/res для Express.
 *
 * app.listen() здесь НЕ нужен — как и на Vercel: соединением управляет
 * платформа. Для локальной разработки используется `npm run dev` (tsx watch).
 */
const handler = serverlessHttp(app);

export { handler };
