import type { NextFunction, Request, Response } from "express";

import { verifyAdminToken } from "../lib/token";

/**
 * Защита админ-роутов: проверяет Authorization: Bearer <token>.
 * Благодаря src/types/express.d.ts поле req.adminUsername существует
 * в типах — никакого каста "(req as Request & {...})" не нужно.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Требуется авторизация" });
    return;
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    res.status(401).json({ error: "Сессия истекла, войдите заново" });
    return;
  }

  req.adminUsername = payload.username;
  next();
}
