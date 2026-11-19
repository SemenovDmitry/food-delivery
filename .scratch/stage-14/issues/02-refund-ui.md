# 02: UI refund — чип «Возвращено», баннеры, Dialog

**What to build:** (спека решения 6–8) `components/shop/order-tracker.tsx`: **PaymentChip** — refunded → бейдж «Возвращено» (success-токены, как «Оплачено»); **исключение из «чип скрыт на отменённых»** — refunded/refunding чип показывается И на отменённых (ответ на вопрос «а деньги?»; «Ожидает оплаты» по-прежнему скрыт). RSC `(shop)/orders/[id]/page.tsx` — читает payments-статус отменённого online-заказа (getOrderById или отдельный select) → проп `refundState` в OrderTracker → тексты **CancelledBanner**: customer «Вы отменили этот заказ — средства вернутся на счёт» / vendor «Заказ отклонён заведением — возврат выполнится автоматически»; refundState=refunded → «Возврат выполнен» (присоединяется к тексту). Dialog отмены: если paymentStatus=paid (трекер знает из поллинга-DTO orders.paymentStatus — остаётся paid) — description дополнить «Средства вернутся на счёт». Кнопка отмены оплаченного: canCancel уже по статусам created|preparing — работала и раньше (клик падал в гвард), теперь выполняет refund. `/admin/orders`: select уже показывает `cancelled_by_vendor` — сервер пропустит paid-online (гвард ядра 01); тексты тостов прежние. Storybook: `order-tracker.stories.tsx` += сторя `RefundedCancelled` (баннер + чип «Возвращено» на отменённом — args), axe-аудит новой стори в общем прогоне. Поллинг-DTO не расширяется (спека #8).

**Blocked by:** 01

**Status:** open

- [ ] PaymentChip: «Возвращено» (refunded) — виден и на отменённых
- [ ] Баннеры отмены оплаченного с возвратом (refundState-проп из RSC)
- [ ] Dialog отмены оплаченного — «Средства вернутся на счёт»
- [ ] Storybook: сторя RefundedCancelled, axe чист
- [ ] lint/tsc/build-storybook зелёные
