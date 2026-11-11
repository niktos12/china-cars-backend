import { desc, eq } from "drizzle-orm";
import { Router } from "express";

import { getDb } from "../db";
import { dbErrorMessage } from "../lib/db-errors";
import { leads, products } from "../db/schema";
import { demoLeads, DEMO_PRODUCTS } from "../lib/demo-data";
import {
  adminLoginSchema,
  productPayloadSchema,
  productUpdateSchema,
} from "../lib/validation";
import {
  createAdminToken,
  isAdminConfigured,
} from "../lib/token";
import { requireAdmin } from "../middleware/auth";

/**
 * Админ-API. Все роуты, кроме /login, защищены requireAdmin:
 * клиент (админка во фронтенд-репо) присылает Authorization: Bearer <token>.
 *
 * ИСПРАВЛЕНИЕ ОШИБКИ СБОРКИ TS2352 (строка ~65 в старой версии):
 * раньше поле на request ставили кастом
 *   (req as Request & { adminUsername?: string }).adminUsername = username
 * — имя Request попадало на ГЛОБАЛЬНЫЙ тип Fetch API, а не на Express.
 * Теперь поле объявлено аугментацией в src/types/express.d.ts и
 * пишется напрямую: req.adminUsername = username. Кастов больше нет.
 */
export const adminRouter = Router();

/* ------------------------------------------------------------------ */
/* POST /api/admin/login — обмен логин/пароль на JWT                   */
/* ------------------------------------------------------------------ */
adminRouter.post("/login", async (req, res) => {
  if (!isAdminConfigured()) {
    res.status(503).json({
      error:
        "Админка не настроена: задайте ADMIN_USERNAME, ADMIN_PASSWORD и ADMIN_JWT_SECRET в Variables",
    });
    return;
  }

  const parsed = adminLoginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(422).json({ error: "Введите логин и пароль" });
    return;
  }

  const { username, password } = parsed.data;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = password === process.env.ADMIN_PASSWORD;

  // Единое сообщение — не раскрываем, что именно неверно
  if (!validUser || !validPass) {
    // Небольшая задержка против перебора паролей
    await new Promise((r) => setTimeout(r, 400));
    res.status(401).json({ error: "Неверный логин или пароль" });
    return;
  }

  const token = await createAdminToken(username);
  res.json({ ok: true, token, expiresIn: "8h" });
});

/* ------------------------------------------------------------------ */
/* Далее — только с валидным Bearer-токеном                            */
/* ------------------------------------------------------------------ */
adminRouter.use(requireAdmin);

/* ---------------------------- Заявки ------------------------------ */

/** GET /api/admin/leads — список заявок, свежие сверху */
adminRouter.get("/leads", async (_req, res) => {
  const db = getDb();

  if (!db) {
    res.json({ demo: true, leads: [...demoLeads].reverse() });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(leads)
      .orderBy(desc(leads.createdAt))
      .limit(200);
    res.json({ demo: false, leads: rows });
  } catch (err) {
    console.error("[GET /api/admin/leads] DB error:", err);
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

/** DELETE /api/admin/leads/:id — удалить заявку (кнопка в админке) */
adminRouter.delete("/leads/:id", async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ error: "БД не подключена: изменение недоступно в демо-режиме" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  try {
    const deleted = await db
      .delete(leads)
      .where(eq(leads.id, id))
      .returning({ id: leads.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Заявка не найдена" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/leads/:id] DB error:", err);
    res.status(500).json({ error: "Не удалось удалить заявку" });
  }
});

/* ---------------------------- Товары ------------------------------ */

/** GET /api/admin/products — полный список, включая isActive=false */
adminRouter.get("/products", async (_req, res) => {
  const db = getDb();

  if (!db) {
    res.json({
      demo: true,
      products: DEMO_PRODUCTS.map((p, i) => ({
        id: i + 1,
        ...p,
        priceFrom: p.priceFrom ?? null,
        imageUrl: p.imageUrl ?? null,
        isActive: true,
      })),
    });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
    res.json({ demo: false, products: rows });
  } catch (err) {
    console.error("[GET /api/admin/products] DB error:", err);
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});

/** POST /api/admin/products — создать позицию */
adminRouter.post("/products", async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ error: "БД не подключена: изменение недоступно в демо-режиме" });
    return;
  }

  const parsed = productPayloadSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(422).json({
      error: parsed.error.issues[0]?.message ?? "Проверьте поля товара",
    });
    return;
  }

  try {
    const exists = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, parsed.data.slug))
      .limit(1);
    if (exists.length > 0) {
      res.status(409).json({ error: "Товар с таким slug уже существует" });
      return;
    }

    const inserted = await db
      .insert(products)
      .values({
        ...parsed.data,
        priceFrom: parsed.data.priceFrom ?? null,
        imageUrl: parsed.data.imageUrl || null,
      })
      .returning();
    res.status(201).json({ ok: true, product: inserted[0] });
  } catch (err) {
    console.error("[POST /api/admin/products] DB error:", err);
    res.status(500).json({ error: "Не удалось создать товар" });
  }
});

/** PUT /api/admin/products/:id — обновить позицию */
adminRouter.put("/products/:id", async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ error: "БД не подключена: изменение недоступно в демо-режиме" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  const parsed = productUpdateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(422).json({
      error: parsed.error.issues[0]?.message ?? "Проверьте поля товара",
    });
    return;
  }

  try {
    const updated = await db
      .update(products)
      .set({
        ...parsed.data,
        ...(parsed.data.priceFrom !== undefined
          ? { priceFrom: parsed.data.priceFrom ?? null }
          : {}),
        ...(parsed.data.imageUrl !== undefined
          ? { imageUrl: parsed.data.imageUrl || null }
          : {}),
      })
      .where(eq(products.id, id))
      .returning();

    if (updated.length === 0) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json({ ok: true, product: updated[0] });
  } catch (err) {
    console.error("[PUT /api/admin/products/:id] DB error:", err);
    res.status(500).json({ error: "Не удалось обновить товар" });
  }
});

/** DELETE /api/admin/products/:id — удалить позицию */
adminRouter.delete("/products/:id", async (req, res) => {
  const db = getDb();
  if (!db) {
    res.status(503).json({ error: "БД не подключена: изменение недоступно в демо-режиме" });
    return;
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Некорректный id" });
    return;
  }

  try {
    const deleted = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (deleted.length === 0) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/admin/products/:id] DB error:", err);
    res.status(500).json({ error: "Не удалось удалить товар" });
  }
});

/** Кто выполняет запрос — полезно для логов; поле приходит из requireAdmin */
adminRouter.get("/me", (req, res) => {
  res.json({ username: req.adminUsername ?? null });
});
