import "server-only";

import type { Promotion } from "@/db/schema";

/**
 * Окно действия акции — единая проверка для чтений вне кеша (§5.3):
 * queries/promotions (лента) и actions/orders (ревалидация промокода).
 */
export function isPromoInWindow(promo: Promotion, now: Date): boolean {
  const started = !promo.startsAt || promo.startsAt.getTime() <= now.getTime();
  const notEnded = !promo.endsAt || promo.endsAt.getTime() >= now.getTime();
  return started && notEnded;
}
