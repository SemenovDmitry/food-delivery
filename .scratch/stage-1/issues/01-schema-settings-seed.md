# 01: Схема скидок с условиями, доставка, settings, сидер-заглушки

**What to build:** Одна миграция drizzle-kit: условия акции (скоуп-категория + минимальная сумма), стоимость доставки на заказе, таблица настроек доставки. Сидер приведён к модели скоуп-акций (заглушки до этапа 5). Константы и `getDeliverySettings()` как шов для админки.

**Blocked by:** —

**Status:** resolved

- [x] Миграция drizzle-kit (SQL в git, `db:push` не используем): `promotions.categoryId` — integer nullable, FK → categories, `onDelete: 'restrict'` (null = весь заказ; restrict — удаление категории не расширяет скидку молча); `promotions.minTotal` — integer NOT NULL DEFAULT 0 (копейки, 0 = без условия)
- [x] Миграция: `orders.deliveryFee` — integer NOT NULL DEFAULT 0 (копейки)
- [x] Миграция: таблица `settings` — `key text PRIMARY KEY`, `value text NOT NULL`, `updatedAt`; ключи `delivery_fee`, `free_delivery_threshold`
- [x] `lib/constants.ts`: `DELIVERY_FEE = 19900`, `FREE_DELIVERY_THRESHOLD = 100000` (рядом с MAX_QTY)
- [x] `lib/settings.ts`: `getDeliverySettings()` — чтение `settings` (динамическое, без `'use cache'`), при отсутствии строк — fallback на константы; возвращает `{ deliveryFee, freeDeliveryThreshold }`
- [x] Сидер: «Счастливые часы» удалены; `SHAWARMA20` −20% → categoryId шаурмы; `PIZZA300` −300 ₽ + minTotal 100000 → categoryId пиццы; `COMBO150` −150 ₽ → categoryId сетов; resolve категории по slug (идемпотентно)
- [x] Повторный `pnpm db:seed` не создаёт дублей; `pnpm db:migrate` применяется на живой БД чисто
