import crypto from "node:crypto";

/**
 * JWT-токен администратора (HS256, 8 часов) — БЕЗ ВНЕШНИХ ПАКЕТОВ.
 *
 * Раньше использовался пакет jose: он тянул в бандл десятки зависимостей
 * и был одной из причин проблем при сборке функции на Vercel. HS256-JWT —
 * это просто base64url(header).base64url(payload).HMAC-SHA256(...), поэтому
 * считаем его встроенным модулем crypto: меньше зависимостей — меньше точек
 * отказа при холодном старте serverless-функции.
 *
 * Секрет — ADMIN_JWT_SECRET. Никаких cookies: фронт хранит токен
 * в localStorage и присылает в заголовке Authorization: Bearer <token>.
 */

export interface AdminTokenPayload {
  username: string;
  exp: number;
}

const TOKEN_TTL_SECONDS = 8 * 60 * 60; // 8 часов

function getSecret(): string | null {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  return secret;
}

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      getSecret(),
  );
}

/* ------------------------- base64url helpers ------------------------- */

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function hmac(data: string, secret: string): string {
  return b64url(
    crypto.createHmac("sha256", secret).update(data).digest(),
  );
}

/* ----------------------------- JWT API ------------------------------- */

export async function createAdminToken(username: string): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_JWT_SECRET не задан");

  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }),
  );
  const signature = hmac(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenPayload | null> {
  const secret = getSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  // Подпись сравниваем в constant-time, чтобы не открыть тайминг-атаку
  const expected = hmac(`${header}.${payload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(fromB64url(payload).toString("utf8")) as {
      username?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.username !== "string") return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now() / 1000) {
      return null; // истёк
    }
    return { username: parsed.username, exp: parsed.exp };
  } catch {
    return null;
  }
}
