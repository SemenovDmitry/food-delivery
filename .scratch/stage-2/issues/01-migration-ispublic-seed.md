# 01: Миграция isPublic + сидер SECRET15

**What to build:** Колонка публичности в `promotions` (default true — существующие акции остаются публичными). Сидер пишет `isPublic` явно и добавляет скрытый промокод `SECRET15` −15% на весь заказ. Термины — GLOSSARY «Публичная акция» / «Скрытый промокод».

**Blocked by:** —

**Status:** resolved

- [x] Схема `src/db/schema.ts`: `promotions.isPublic` — `boolean('is_public').notNull().default(true)`, комментарий со ссылкой на GLOSSARY (public → лента/`/promo`/API/блок корзины; hidden → только ввод кода на /cart)
- [x] Миграция drizzle-kit: `pnpm db:generate` (SQL в git, `db:push` не используем) + `pnpm db:migrate` на живой БД; существующие 3 акции получают default true
- [x] Сидер: `SeedPromotion` получает `isPublic?: boolean`; `values` пишет `isPublic: promo.isPublic ?? true` явно — повторный прогон исправляет дрейф
- [x] Сидер: `SECRET15` — percent 15, `categoryId: null` (весь заказ), `minTotal: 0`, `isPublic: false`, окно как у остальных (startsAt сутки назад, `daysOffset: 30`); код в верхнем регистре (applyPromoCode нормализует ввод в uppercase)
- [x] Повторный `pnpm db:seed` идемпотентен (SECRET15 resolve по коду, без дублей); миграция применяется на живой БД чисто
