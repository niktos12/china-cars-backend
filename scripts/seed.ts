/**
 * Первичное наполнение БД демо-товарами: npm run db:seed
 * Повторный запуск безопасен (конфликт по slug игнорируется).
 */
import "dotenv/config";

import { getDb, isDbConfigured } from "../src/db";
import { products } from "../src/db/schema";
import { DEMO_PRODUCTS } from "../src/lib/demo-data";

async function main() {
  if (!isDbConfigured) {
    console.error("DATABASE_URL не задан. Заполните .env и повторите.");
    process.exit(1);
  }

  const db = getDb()!;
  await db.insert(products).values(DEMO_PRODUCTS).onConflictDoNothing({
    target: products.slug,
  });

  console.log(`Засеяно позиций: ${DEMO_PRODUCTS.length}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
