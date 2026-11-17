# 01: Ядро transitionOrderStatus + SMS-строка при ready

**What to build:** Вынести тело `updateOrderStatus` ([src/lib/actions/orders.ts:317](E:\repositories\food-delivery\src\lib\actions\orders.ts)) в ядро `transitionOrderStatus(orderId, next)` в `src/lib/order-transition.ts` — **без auth и кеш-вызовов**: select заказа (+`phone` к текущему select), карта `nextStatuses`, гвард платной отмены, гвард кухни (online+pending → preparing запрещён), `collectOnReceipt` (delivered|picked_up → paid), conditional UPDATE по статусу, строка в `order_status_events` — всё как сегодня. Добавка: при `next === 'ready'` — в **той же транзакции** строка в `notifications` (`channel='sms'`, `event='order.ready'`, `status='pending'`, payload `{to: order.phone, text, orderId, fulfillment}`); текст рендерится в момент вставки чистой функцией в `lib/notifications/` — «Ваш заказ № XXXXXXXX готов — курьер скоро выедет» (доставка) / «Ваш заказ № XXXXXXXX готов к самовывозу» (самовывоз), номер = `slice(0, 8)`. Action-обёртка `updateOrderStatus` = `requireAdmin` + `isUuid`/`isOrderStatus` + вызов ядра + `updateTag('orders')` + `revalidatePath('/admin/orders')` — тексты ошибок ядра возвращаются дословно (сохранить UX). Флушера ещё нет — строка лежит `pending` до тикета 02 (проверка SQL'ем).

**Blocked by:** —

**Status:** resolved

- [x] `src/lib/order-transition.ts` — ядро с гвардами/conditional UPDATE/событием; `updateOrderStatus` — тонкая обёртка, тексты ошибок дословно
- [x] SMS-строка в транзакции ядра при `ready`: payload `{to, text, orderId, fulfillment}`, текст ветвится по fulfillment, короткий id
- [x] SQL-проверка: админ доводит on_receipt-заказ до `ready` → строка в `notifications` (`pending`, корректный payload); до `ready` не дошли → строки нет
- [x] Регрессия гвардов: платная отмена → «Оплаченный заказ отменить нельзя»; неоплаченный онлайн → preparing нет в select + отказ действия; `cancelOrder`/этап-9-гварды не задеты
- [x] lint + `tsc --noEmit` зелёные

## Comments

- 2026-11-18 (реализация): ядро transitionOrderStatus вынесено в src/lib/order-transition.ts (select + карта + гварды + tx + события + SMS); action — requireAdmin + вызов ядра + updateTag/revalidatePath только при успехе. SMS-рендер — чистая функция lib/notifications/order-ready.ts. Смоук против dev-БД (.scratch/stage-10/smoke.ts): гварды (unpaid-online, платная отмена, недопустимый переход из терминала), SMS-строка pending в той же транзакции с payload {to, text, orderId, fulfillment} (обе ветки fulfillment), цепочки событий сходятся. Проверка «админ доводит до ready» — на уровне ядра; action-уровень (select в UI, requireAdmin) — приёмка, сценарий 5.
