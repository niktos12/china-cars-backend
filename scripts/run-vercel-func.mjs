/**
 * Локальный прогон собранной Vercel-функции (.vercel/output/functions/api/index.func)
 * через обычный http-сервер — имитация Nodejs-лаунчера Vercel.
 * Usage: node scripts/run-vercel-func.mjs <port>
 */
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const funcDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.vercel/output/functions/api/index.func",
);

const require = createRequire(path.join(funcDir, "api/", "index.js"));
const handler = require(path.join(funcDir, "api/index.js")).default;

const port = Number(process.argv[2] ?? 3300);

const server = http.createServer((req, res) => {
  try {
    handler(req, res);
  } catch (err) {
    console.error("[handler sync throw]", err);
    res.statusCode = 500;
    res.end("handler throw: " + err.message);
  }
});

server.listen(port, () => {
  console.log(`func runner on http://localhost:${port}`);
});
