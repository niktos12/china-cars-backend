import { Router } from "express";

import {
  ADMIN_PASSWORD,
  ADMIN_USERNAME,
  checkCredentials,
  clearSessionCookie,
  requireAdmin,
  setSessionCookie,
} from "../auth";
import {
  createProduct,
  deleteLead,
  deleteProduct,
  getAllProducts,
  getLeads,
  getProductById,
  updateProduct,
} from "../queries";
import { adminLoginSchema, productFormSchema } from "../validation";
import { ah } from "./public";

/**
 * Административные эндпоинты (монтируются на /api/admin).
 * Всё, кроме /login, закрыто мидлварой requireAdmin (HMAC-cookie).
 * Фронтенд вызывает их через тот же прокси Next.js — cookie ходит
 * автоматически, т.к. для браузера это same-origin запросы.
 */
export const adminRouter = Router();

/** POST /api/admin/login — вход: 200 + Set-Cookie · 401 · 422. */
adminRouter.post(
  "/login",
  ah(async (req, res) => {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        error: parsed.error.issues[0]?.message ?? "Заполните поля",
      });
      return;
    }

    if (
      !checkCredentials(parsed.data.username, parsed.data.password)
    ) {
      // Небольшая задержка против перебора паролей
      await new Promise((r) => setTimeout(r, 600));
      res.status(401).json({ error: "Неверный логин или пароль" });
      return;
    }

    setSessionCookie(res, parsed.data.username);
    res.json({ ok: true, username: parsed.data.username });
  }),
);

/** POST /api/admin/logout — выход: сбрасываем cookie. */
adminRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

/** GET /api/admin/me — кто вошёл (проверка сессии). */
adminRouter.get("/me", requireAdmin, (req, res) => {
  res.json({ username: (req as Request & { adminUsername?: string }).adminUsername });
});

/** GET /api/admin/overview — сводка для главной страницы админки. */
adminRouter.get(
  "/overview",
  requireAdmin,
  ah(async (_req, res) => {
    const [{ products, demo: pDemo }, { leads, demo: lDemo }] =
      await Promise.all([getAllProducts(), getLeads()]);
    const last = leads[0] ?? null;
    res.json({
      productsCount: products.length,
      activeProductsCount: products.filter((p) => p.isActive).length,
      leadsCount: leads.length,
      lastLead: last
        ? {
            id: last.id,
            name: last.name,
            phone: last.phone,
            carModel: last.carModel,
            message: last.message,
            createdAt: last.createdAt,
          }
        : null,
      demo: pDemo || lDemo,
    });
  }),
);

/* ------------------------------- ЗАЯВКИ -------------------------------- */

/** GET /api/admin/leads — все заявки, новые сверху. */
adminRouter.get(
  "/leads",
  requireAdmin,
  ah(async (_req, res) => {
    res.json(await getLeads());
  }),
);

/** DELETE /api/admin/leads/:id */
adminRouter.delete(
  "/leads/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Некорректный id" });
      return;
    }
    const result = await deleteLead(id);
    res.json(result);
  }),
);

/* ------------------------------- ТОВАРЫ -------------------------------- */

/** GET /api/admin/products — все товары, включая скрытые. */
adminRouter.get(
  "/products",
  requireAdmin,
  ah(async (_req, res) => {
    res.json(await getAllProducts());
  }),
);

/** GET /api/admin/products/:id — один товар для формы редактирования. */
adminRouter.get(
  "/products/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Некорректный id" });
      return;
    }
    const { product, demo } = await getProductById(id);
    if (!product) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json({ product, demo });
  }),
);

function parseProductBody(req: { body: unknown }):
  | { ok: true; data: ReturnType<typeof productFormSchema.parse> }
  | { ok: false; error: string } {
  const parsed = productFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Проверьте поля формы",
    };
  }
  return { ok: true, data: parsed.data };
}

/** POST /api/admin/products — создать товар. */
adminRouter.post(
  "/products",
  requireAdmin,
  ah(async (req, res) => {
    const parsed = parseProductBody(req);
    if (!parsed.ok) {
      res.status(422).json({ ok: false, error: parsed.error });
      return;
    }
    const result = await createProduct(parsed.data);
    if (!result.ok) {
      res.status(result.error.includes("slug") ? 409 : 500).json(result);
      return;
    }
    res.status(201).json(result);
  }),
);

/** PUT /api/admin/products/:id — обновить товар. */
adminRouter.put(
  "/products/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Некорректный id" });
      return;
    }
    const parsed = parseProductBody(req);
    if (!parsed.ok) {
      res.status(422).json({ ok: false, error: parsed.error });
      return;
    }
    const result = await updateProduct(id, parsed.data);
    if (!result.ok) {
      const notFound = result.error.includes("не найден");
      res.status(notFound ? 404 : result.error.includes("slug") ? 409 : 500).json(result);
      return;
    }
    res.json(result);
  }),
);

/** DELETE /api/admin/products/:id */
adminRouter.delete(
  "/products/:id",
  requireAdmin,
  ah(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: "Некорректный id" });
      return;
    }
    res.json(await deleteProduct(id));
  }),
);

