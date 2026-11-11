/**
 * Распознавание типовых ошибок Postgres для понятных сообщений в API.
 * Коды: https://www.postgresql.org/docs/current/errcodes-appendix.html
 *
 * ВАЖНО: drizzle-orm оборачивает ошибки драйвера в DrizzleQueryError,
 * а настоящий PostgresError с полем code лежит в err.cause — поэтому
 * код ищем рекурсивно по всей цепочке cause.
 */
interface PgLikeError {
  code?: string;
  message?: string;
  cause?: unknown;
}

/** Найти SQLSTATE-код ошибки, раскрутив цепочку cause */
function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const code = (current as PgLikeError)?.code;
    if (typeof code === "string") return code;
    current = (current as PgLikeError)?.cause;
  }
  return undefined;
}

/** 42P01 — relation does not exist (таблицы не созданы / миграции не применены) */
export function isUndefinedTable(err: unknown): boolean {
  return pgErrorCode(err) === "42P01";
}

/** 28P01 / 28000 — неверный логин-пароль или права доступа к БД */
export function isAuthError(err: unknown): boolean {
  const code = pgErrorCode(err);
  return code === "28P01" || code === "28000";
}

/** Человекочитаемый текст для ответа API при ошибке БД */
export function dbErrorMessage(err: unknown): string {
  if (isUndefinedTable(err)) {
    return "Таблицы БД не созданы — выполните миграции: npm run db:migrate (или npm run db:push), затем npm run db:seed";
  }
  if (isAuthError(err)) {
    return "Не удалось подключиться к БД: проверьте DATABASE_URL (логин/пароль/sslmode)";
  }
  return "Ошибка базы данных";
}
