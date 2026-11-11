import { and, asc, eq } from "drizzle-orm";
import { Router } from "express";

import { getDb } from "../db";
import { products, type Product } from "../db/schema";
import { DEMO_PRODUCTS } from "../lib/demo-data";

export const productsRouter = Router();

/** DTO для фронта: ровно те поля, что ждёт ProductDto в Next.js */
function toDto(p: Product) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    carModel: p.carModel,
    position: p.position,
    material: p.material,
    description: p.description,
    priceFrom: p.priceFrom,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
  };
}

/** Демо-DTO без БД */
function demoDto() {
  return DEMO_PRODUCTS.map((p, i) => ({
    id: i + 1,
    slug: p.slug,
    title: p.title,
    carModel: p.carModel,
    position: p.position,
    material: p.material,
    description: p.description,
    priceFrom: p.priceFrom ?? null,
    imageUrl: p.imageUrl ?? null,
    isActive: true,
  }));
}

/**
 * GET /api/products — публичный каталог (только isActive).
 * Без БД отдаёт демо-набор с флагом demo: true (фронт покажет бейдж).
 */
productsRouter.get("/", async (_req, res) => {
  const db = getDb();

  if (!db) {
    res.set("Cache-Control", "no-store");
    res.json({ demo: true, products: demoDto() });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(products)
      .where(eq(products.isActive, true))
      .orderBy(asc(products.createdAt));
    res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.json({ demo: false, products: rows.map(toDto) });
  } catch (err) {
    console.error("[GET /api/products] DB error:", err);
    res.status(500).json({ error: "Ошибка базы данных" });
  }
});

/** GET /api/products/:slug — одна позиция для страницы товара */
productsRouter.get("/:slug", async (req, res) => {
  const db = getDb();
  const slug = String(req.params.slug ?? "");

  if (!db) {
    const demo = demoDto().find((p) => p.slug === slug);
    if (!demo) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json({ demo: true, product: demo });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(products)
      .where(and(eq(products.slug, slug), eq(products.isActive, true)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ error: "Товар не найден" });
      return;
    }
    res.json({ demo: false, product: toDto(row) });
  } catch (err) {
    console.error("[GET /api/products/:slug] DB error:", err);
    res.status(500).json({ error: "Ошибка базы данных" });
  }
});
