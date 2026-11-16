# 01: order_status_events — миграция + писатель в createOrder

**What to build:** Таблица `order_status_events` (id uuid pk default random, `order_id` uuid NOT NULL FK → orders.id onDelete cascade, `status` text NOT NULL, `created_at` timestamp NOT NULL defaultNow) в `src/db/schema.ts` + тип `OrderStatusEvent`; миграция drizzle-kit generate (SQL в git, §5.12). `createOrder` в `lib/actions/orders.ts` пишет событие `created` в существующей транзакции (INSERT + INSERT order_items + очистка корзины — один tx). Писатели остальных этапов: `cancelOrder` (тикет 05), `updateOrderStatus` (этап 5), автоджоба (этап 10). UI таблицу пока не читает (Q15a).

**Blocked by:** —

**Status:** resolved

- [x] Схема + экспорт типа `OrderStatusEvent` (§11 навигация: домен — schema.ts)
- [x] `pnpm db:generate` — SQL-файл миграции закоммичен
- [x] `pnpm db:migrate` на dev-БД (postgres :5560)
- [x] `createOrder`: строка `created` в той же транзакции, что заказ + items + очистка корзины
- [x] Идемпотентность сидера не задета (сидер заказов не создаёт)
