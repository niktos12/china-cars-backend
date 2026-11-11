import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Авторизация админки (Express-сторона):
 *  - логин/пароль берутся из переменных окружения (значения по умолчанию —
 *    только для локального запуска, на Railway ОБЯЗАТЕЛЬНО переопределить);
 *  - после входа выдаётся подписанная HMAC cookie со сроком жизни 7 дней;
 *  - каждый защищённый запрос проверяет подпись и срок.
 *
 * Фронтенд (Next.js) проверяет ту же cookie ТОЙ ЖЕ схемой, чтобы решать,
 * пускать ли пользователя в /admin/*. Поэтому ADMIN_SESSION_SECRET
 * должен совпадать на фронтенде и на бэкенде.
 */

export const COOKIE_NAME = "sc_admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 дней

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const SECRET =
  process.env.ADMIN_SESSION_SECRET || "dev-secret-change-me-on-railway";

type SessionPayload = { u: string; exp: number };

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function createToken(username: string): string {
  const payload: SessionPayload = {
    u: username,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Проверка токена (используется и бэкендом, и фронтендом). */
export function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function checkCredentials(username: string, password: string): boolean {
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
}

export function setSessionCookie(res: Response, username: string): void {
  res.cookie(COOKIE_NAME, createToken(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/** Логин админа из запроса (cookie читает cookie-parser) или null. */
export function getUsernameFromRequest(req: Request): string | null {
  return verifyToken(req.cookies?.[COOKIE_NAME])?.u ?? null;
}

/** Express-мидлвара: без валидной сессии — 401. */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const username = getUsernameFromRequest(req);
  if (!username) {
    res.status(401).json({ error: "Сессия истекла. Войдите заново." });
    return;
  }
  (req as Request & { adminUsername?: string }).adminUsername = username;
  next();
}
