import { desc } from "drizzle-orm";
import { Router } from "express";

import { getDb } from "../db";
import { dbErrorMessage } from "../lib/db-errors";
import { leads } from "../db/schema";
import { demoLeads } from "../lib/demo-data";
import { leadSchema } from "../lib/validation";

export const leadsRouter = Router();

/**
 * POST /api/leads — приём заявки с сайта.
 * Публичный эндпоинт; объём данных ограничен express.json({ limit: "32kb" }),
 * валидация zod, при БД — INSERT, без БД — консоль + память (demo).
 */
leadsRouter.post("/", async (req, res) => {
  const parsed = leadSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(422).json({
      ok: false,
      error: first?.message ?? "Проверьте правильность заполнения полей",
    });
    return;
  }

  const { name, phone, carModel, message } = parsed.data;
  const source =
    typeof req.query.source === "string" && req.query.source.length <= 60
      ? req.query.source
      : "website";

  const db = getDb();

  if (!db) {
    const id = demoLeads.length + 1;
    demoLeads.push({
      id,
      name,
      phone,
      carModel: carModel || null,
      message: message || null,
      source,
      createdAt: new Date().toISOString(),
    });
    console.log(
      `[DEMO] Заявка #${id}: ${name}, ${phone}, ${carModel || "-"}, источник: ${source}`,
    );
    res.status(201).json({ ok: true, id, demo: true });
    return;
  }

  try {
    const inserted = await db
      .insert(leads)
      .values({
        name,
        phone,
        carModel: carModel || null,
        message: message || null,
        source,
      })
      .returning({ id: leads.id });

    res.status(201).json({ ok: true, id: inserted[0]?.id ?? null, demo: false });
  } catch (err) {
    console.error("[POST /api/leads] DB error:", err);
    res
      .status(500)
      .json({ ok: false, error: dbErrorMessage(err) });
  }
});

/** GET /api/leads — служебный список (используется админкой, дублирует admin-роут) */
leadsRouter.get("/", async (_req, res) => {
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
    console.error("[GET /api/leads] DB error:", err);
    res.status(500).json({ error: dbErrorMessage(err) });
  }
});
