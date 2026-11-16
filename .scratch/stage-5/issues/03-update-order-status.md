# 03: updateOrderStatus — карта переходов + транзакция + события

**What to build:** `nextStatuses(status, fulfillment)` в `lib/order-timeline.ts` (рядом с ACTIVE/TERMINAL/CANCELLABLE, client-safe): вперёд по цепочке своего fulfillment (`created→preparing→ready→(in_delivery→delivered|picked_up)`), назад никогда; `cancelled_by_vendor` разрешён из `created|preparing|ready`. Action `updateOrderStatus(orderId, nextStatus)` в `lib/actions/orders.ts`: гард `getAdminSession` (живой, тикет 02) → чтение заказа → валидация против карты → **paid-гвард**: `cancelled_by_vendor` при `paymentStatus='paid'` запрещён (refund вне скоупа, этап 9) → транзакция: conditional `UPDATE orders SET status WHERE id AND status = ожидаемый` RETURNING (гонка, паттерн `cancelOrder`; 0 строк → error «Статус уже изменён») + INSERT `order_status_events` в той же транзакции (Q15a этапа 4) → `updateTag('orders')` (паттерн `createOrder`, §5.3). SMS «готов» НЕ пишется (этап 10). Manager и admin — оба.

**Blocked by:** 02

**Status:** resolved

- [ ] `nextStatuses(status, fulfillment)` + экспорт из `lib/order-timeline.ts`
- [ ] Action: гарды (live-сессия, карта, paid) + транзакция (conditional UPDATE + events)
- [ ] `updateTag('orders')`
- [ ] Негативы: paid-cancel → ошибка; назад → ошибка; гонка (статус сменили параллельно) → «Статус уже изменён»
- [ ] Верификация БД: строка в `order_status_events` на каждую легальную смену
