# 01: Миграция paymentMethod/unique/payment_methods + статус cancelled_by_timeout + сидер + env

**What to build:** Миграция `0006_*` через drizzle-kit generate (SQL в git, §5.12): `orders.payment_method` — text NOT NULL default `'on_receipt'` (значения `online | on_receipt`; старые заказы остаются валидными); `payments` — `unique(order_id)` (одна строка payment на заказ, Q2; повторная попытка переиспользует строку); новая таблица `payment_methods` — `id` uuid pk defaultRandom, `code` text unique (`sber`/`unionpay`), `label` text («Сбербанк», «UnionPay»), `is_active` boolean NOT NULL default true, `position` integer NOT NULL default 0, `created_at`. Новый терминальный статус: `ORDER_STATUSES` += `'cancelled_by_timeout'` (миграции НЕ требует — text-колонка + TS-константа, pgEnum в проекте не используется); `TERMINAL_STATUSES` += (поллинг замолкает, исчезает из активных карточек); `STATUS_LABELS` += «Отменён: не оплачен»; `StatusBadge` (`components/shop/status-badge.tsx`) — маппинг в destructive-токен как у других отмен; чипы фильтров `/admin/orders` — проверить, выводятся ли из констант (если хардкод «8 статусов» — расширить). Сидер: идемпотентно вставляет `sber` + `unionpay` активными (position 1/2; повтор `db:seed` не дублирует — по `code`). `.env.example` += `PAYMENT_WINDOW_MINUTES=5` с комментом; чтение в коде — по образцу `DEMO_AUTO_STATUS` (default 5). GLOSSARY уже дополнен при спеке (Онлайн-оплата, Провайдер оплаты, Окно оплаты; «Статус заказа» = 9 значений).

**Blocked by:** —

**Status:** open

- [ ] `pnpm db:generate` → `drizzle/0006_*.sql` закоммичен, `pnpm db:migrate` накатывает чисто, повтор идемпотентен
- [ ] Схема: `orders.paymentMethod`, `unique(payments.orderId)`, `paymentMethods` + типы `$inferSelect` экспортированы
- [ ] `ORDER_STATUSES`/`TERMINAL_STATUSES`/`STATUS_LABELS` знают `cancelled_by_timeout`; tsc зелёный
- [ ] `StatusBadge` рисует destructive для нового статуса
- [ ] Чипы фильтров `/admin/orders` содержат новый статус (из констант или правкой хардкода)
- [ ] Сидер: sber + unionpay активны, повторный seed не дублирует
- [ ] `.env.example` += `PAYMENT_WINDOW_MINUTES=5`
