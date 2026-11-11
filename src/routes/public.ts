import { Router } from "express";

import { isDbConfigured } from "../db";
import {
  createLead,
  getProducts,
  getProductBySlug,
  getRelatedProducts,
} from "../queries";
import { leadSchema } from "../validation";

/** Обёртка для async-обработчиков: любые ошибки уходят в error-мидлвару. */
export const ah =
  (fn: (req: import("express").Request, res: import("express").Response) => Promise<unknown>) =>
  (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    fn(req, res).catch(next);
  };

/**
 * Публичные эндпоинты (монтируются на /api).
 * Браузер попадает сюда через прокси Next.js: fetch('/api/...') → Express.
 */
export const publicRouter = Router();

/** GET /api/health — healthcheck Railway/Vercel и ручная диагностика. */
publicRouter.get("/health", (_req, res) => {
  res.json({ ok: true, db: isDbConfigured ? "configured" : "demo" });
});

/** GET /api/products — каталог для витрины (SWR). */
publicRouter.get(
  "/products",
  ah(async (_req, res) => {
    res.json(await getProducts());
  }),
);

/**
 * GET /api/products/:slug — страница товара:
 * { product, related: ProductDto[], demo }
 */
publicRouter.get(
  "/products/:slug",
  ah(async (req, res) => {
    const slug = String(req.params.slug ?? "").slice(0, 120);
    const { product, demo } = await getProductBySlug(slug);
    if (!product) {
      res.status(404).json({ product: null, related: [], demo });
      return;
    }
    const { products: related } = await getRelatedProducts(
      product.carModel,
      product.slug,
    );
    res.json({ product, related, demo });
  }),
);

/**
 * POST /api/leads — приём заявки.
 * Тело: { name, phone, carModel?, message?, source? }.
 * Ответы: 201 { ok: true, id, demo } · 422/400 { ok: false, error } · 500.
 */
publicRouter.post(
  "/leads",
  ah(async (req, res) => {
    const body = typeof req.body === "object" && req.body !== null ? req.body : {};
    const source =
      typeof body.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 60)
        : "website";

    const parsed = leadSchema.safeParse(body);
    if (!parsed.success) {
      res.status(422).json({
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Проверьте правильность заполнения формы",
      });
      return;
    }

    const result = await createLead(parsed.data, source);
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    res.status(201).json(result);
  }),
);
