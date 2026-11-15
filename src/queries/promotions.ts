import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import type { Promotion } from "@/db/schema";
import { isPromoInWindow } from "@/lib/promo";

/**
 * Кешируются ДАННЫЕ активных акций (isActive=true) — без времён (§5.3):
 * окно startsAt/endsAt фильтруется на чтении ВНЕ кеша в getActivePromotions.
 */
export async function getCachedActivePromotions(): Promise<Promotion[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("promos");

  return db
    .select()
    .from(promotions)
    .where(eq(promotions.isActive, true))
    .orderBy(asc(promotions.createdAt));
}

/**
 * Обёртка без кеша: окно действия проверяется на каждом чтении (акция исчезает ровно в конце окна).
 * `connection()` обязателен: new Date() — синхронное IO, при пререндере Suspense сам его не спрячет
 * (docs/cache-components: «wrap in Suspense AND call connection() before the call»).
 */
export async function getActivePromotions(): Promise<Promotion[]> {
  // connection() ПЕРВЫМ: всё после него уходит в рантайм — иначе кеш-функция
  // исполнится на пререндере сборки и потребует живую БД (§5.3)
  await connection();
  const promos = await getCachedActivePromotions();
  const now = new Date();
  return promos.filter((p) => isPromoInWindow(p, now));
}
