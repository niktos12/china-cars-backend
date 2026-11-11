import { SignJWT, jwtVerify } from "jose";

/**
 * JWT-токен администратора (HS256, 8 часов).
 * Секрет — ADMIN_JWT_SECRET. Никаких cookies: фронт хранит токен
 * в localStorage и присылает в заголовке Authorization: Bearer <token>.
 * Это избавляет от междоменных cookie (SameSite/Secure) между
 * фронтенд- и бэкенд-доменами на Vercel.
 */

export interface AdminTokenPayload {
  username: string;
}

function getSecret(): Uint8Array | null {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 16) return null;
  return new TextEncoder().encode(secret);
}

export function isAdminConfigured(): boolean {
  const ok =
    Boolean(process.env.ADMIN_USERNAME) &&
    Boolean(process.env.ADMIN_PASSWORD) &&
    Boolean(getSecret());
  return ok;
}

export async function createAdminToken(
  username: string,
): Promise<string> {
  const secret = getSecret();
  if (!secret) throw new Error("ADMIN_JWT_SECRET не задан");

  return new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifyAdminToken(
  token: string,
): Promise<AdminTokenPayload | null> {
  const secret = getSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    if (typeof payload.username !== "string") return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}
