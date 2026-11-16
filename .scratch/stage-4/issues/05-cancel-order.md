# 05: cancelOrder — action + Dialog-подтверждение

**What to build:** Action `cancelOrder(orderId)` в `lib/actions/orders.ts` → `ActionResult<{ cancelled: true }>`: гард `isUuid` (§5.24) → «Заказ не найден»; проверка существования; в `db.transaction()`: UPDATE `orders SET status='cancelled_by_customer', updatedAt=now() WHERE id=? AND status IN (CANCELLABLE_STATUSES) AND payment_status='pending'` → 0 строк → error «Заказ уже в работе — отменить нельзя» (гонка, Q12); успех → INSERT `order_status_events` ('cancelled_by_customer') в той же транзакции; `revalidatePath('/orders')`. Доступ — как у страницы (владелец или держатель uuid-ссылки; отдельной проверки сессии нет — Q11a/Q12). UI в `OrderTracker`: кнопка «Отменить заказ» только при `status ∈ CANCELLABLE_STATUSES` (проп `paymentStatus` не нужен — гард серверный, но кнопка скрывается после отмены локальным setState); Dialog (shadcn, focus-trap — a11y §7) «Отменить заказ № …?» с destructive-подтверждением; успех → `setStatus('cancelled_by_customer')` мгновенно + toast; ошибка → toast.error (баннер появится на следующем тике, если статус успел измениться). isPending-состояние кнопки Dialog.

**Blocked by:** 01 (INSERT события), 02 (CANCELLABLE_STATUSES), 04 (место в трекере)

**Status:** resolved

- [x] Action с повторной проверкой в транзакции + событие в той же tx
- [x] 0 строк → человекочитаемая ошибка (ActionResult.error → toast)
- [x] Dialog-подтверждение, destructive-стиль, клавиатурность
- [x] После успеха кнопка исчезает, баннер отмены — сразу (setState)
- [x] `revalidatePath('/orders')` (список — без тегов, персональные данные)

## Comments

Приёмка 2026-11-16. Сценарий гонки в тикете был неточен: SQL-сдвиг в `preparing` — это НЕ гонка, `preparing` остаётся отменяемым по Q12 (отмена из `preparing` прошла легально — бонус-позитив: статус + событие в БД). Настоящая гонка — сдвиг в `ready`: Dialog → SQL `ready` → подтверждение → toast «Заказ уже в работе — отменить нельзя», БД остаётся `ready`, события нет (скриншот t5b). Dialog — `role='alertdialog'` на DialogContent (alert-dialog из реестра shadcn недоступен — сеть), фокус при открытии на «Вернуться» (фокус-ловушка Radix).
