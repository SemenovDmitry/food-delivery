# 02: lib/order-timeline.ts — чистая функция таймлайна

**What to build:** `lib/order-timeline.ts` без `'use server'`/server-only (паттерн `cart-totals.ts` — импортируется и RSC, и клиентом): `buildTimeline(status, fulfillment)` → `TimelineStep[]` (`key: OrderStatus`, `label`, `state: 'done'|'current'|'pending'`); ветка по fulfillment: delivery — `created→preparing→ready→in_delivery→delivered`, pickup — `created→preparing→ready→picked_up` (шаги другой ветки не показываются вовсе); константы `TERMINAL_STATUSES` (`delivered|picked_up|cancelled_by_customer|cancelled_by_vendor`) и `CANCELLABLE_STATUSES` (`created|preparing`) — единый источник для трекера, action и карточки главной; метки шагов из `STATUS_LABELS` (не дублировать строки). Невалидный статус (text-колонка) не должен ронять функцию — вернуть пустой массив/фолбэк (паттерн «не маскируем кастомом», ревью S7).

**Blocked by:** —

**Status:** resolved

- [x] `buildTimeline(status, fulfillment)` — done до текущего, current, pending после; для терминального/отменного статуса — все done (баннер отмены рисует трекер)
- [x] `TERMINAL_STATUSES`, `CANCELLABLE_STATUSES`, `ACTIVE_STATUSES` (`created|preparing|ready|in_delivery`) — экспорт
- [x] Чистая функция: без new Date()/cookies — безопасна для клиента (§5.3 семья)
