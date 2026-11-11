import { z } from "zod";

/**
 * Zod-схемы — копия src/lib/validation.ts фронтенда.
 * ВАЖНО: при изменении правил валидации на фронте синхронизируйте их здесь.
 */

/** Заявка с сайта (POST /api/leads) */
export const leadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Укажите имя (минимум 2 символа)")
    .max(100, "Слишком длинное имя"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s\-()]{6,20}$/, "Введите корректный номер телефона"),
  carModel: z
    .string()
    .trim()
    .max(120, "Слишком длинное название модели")
    .optional()
    .or(z.literal("")),
  message: z
    .string()
    .trim()
    .max(2000, "Комментарий слишком длинный")
    .optional()
    .or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** Товар: создание/редактирование через админ-API (POST/PUT /api/admin/products) */
export const productPayloadSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Только a-z, 0-9 и дефис"),
  title: z.string().trim().min(4).max(200),
  carModel: z.string().trim().min(2).max(120),
  position: z.string().trim().min(2).max(80),
  material: z.string().trim().min(4).max(160),
  description: z.string().trim().min(10).max(4000),
  /** null/undefined = цена по запросу */
  priceFrom: z.number().int().min(0).max(9999999).nullish(),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v),
      "Ссылка должна начинаться с /, http:// или https://",
    )
    .nullish(),
  isActive: z.boolean().default(true),
});

export type ProductPayload = z.infer<typeof productPayloadSchema>;

/** Частичное обновление (PUT): все поля опциональны, но id/slug не пустые */
export const productUpdateSchema = productPayloadSchema.partial();

/** Логин администратора (POST /api/admin/login) */
export const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});
