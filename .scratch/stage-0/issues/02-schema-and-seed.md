# 02: Схема БД и идемпотентный сидер

**What to build:** БД полностью соответствует плану: миграции применяются, сидер идемпотентно создаёт демо-данные (категории, товары, сеты, акции, аккаунты с телефонами), таблицы-заделы будущих этапов существуют и пусты.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] drizzle config (dialect postgres)
- [x] Схема pg-core: user/session/account/verification (better-auth), categories, products (type single|set, emoji, imageUrl nullable, цена в копейках int), set_items, promotions (discountType percent|fixed, code nullable, окно дат, isActive), carts (uuid, user_id nullable, promo_id nullable), cart_items (уникальность пары cart+product), orders (uuid, status, fulfillment, promoId, discountAmount, paymentStatus pending|paid), order_items (снапшот цен/названий)
- [x] ORDER_STATUSES — 8 значений: created, preparing, ready, in_delivery, delivered, picked_up, cancelled_by_customer, cancelled_by_vendor
- [x] user: phone (уникальный) + email (обязательный) + флаги верификации; роли admin/manager/customer
- [x] Заделы (пустые): payments (order_id, amount копейки, status created|processing|paid|failed|cancelled, provider, external_id), notifications (channel, event, payload, status pending|sent|failed, error), error_events (level, message, stack, context)
- [x] db/index.ts (postgres-js) без mkdir/WAL
- [x] Миграции drizzle-kit (generate/migrate), SQL-файлы в git; db:push не используем
- [x] Идемпотентный сидер: 5 категорий, 24 товара (8 пицц, 6 шаурм, 3 сета с составом в set_items, 4 напитка, 3 десерта; imageUrl null — emoji-фолбэк), 4 акции (SHAWARMA20 −20%, COMBO150 −150₽, PIZZA300 −300₽, «Счастливые часы −10%» без кода с окном дат), 3 аккаунта (+7 999 000-00-01 admin / -02 manager / -03 customer, email admin/manager/client@food.local, оба флага верификации true)
- [x] Повторный `pnpm db:seed` не создаёт дублей
