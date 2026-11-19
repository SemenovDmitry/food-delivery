# 02: UI refund — чип «Возвращено», баннеры, Dialog

**What to build:** (спека решения 6–8) `components/shop/order-tracker.tsx`: **PaymentChip** — refunded → бейдж «Возвращено» (success-токены, как «Оплачено»); **исключение из «чип скрыт на отменённых»** — refunded/refunding чип показывается И на отменённых (ответ на вопрос «а деньги?»; «Ожидает оплаты» по-прежнему скрыт). RSC `(shop)/orders/[id]/page.tsx` — читает payments-статус отменённого online-заказа (getOrderById или отдельный select) → проп `refundState` в OrderTracker → тексты **CancelledBanner**: customer «Вы отменили этот заказ — средства вернутся на счёт» / vendor «Заказ отклонён заведением — возврат выполнится автоматически»; refundState=refunded → «Возврат выполнен» (присоединяется к тексту). Dialog отмены: если paymentStatus=paid (трекер знает из поллинга-DTO orders.paymentStatus — остаётся paid) — description дополнить «Средства вернутся на счёт». Кнопка отмены оплаченного: canCancel уже по статусам created|preparing — работала и раньше (клик падал в гвард), теперь выполняет refund. `/admin/orders`: select уже показывает `cancelled_by_vendor` — сервер пропустит paid-online (гвард ядра 01); тексты тостов прежние. Storybook: `order-tracker.stories.tsx` += сторя `RefundedCancelled` (баннер + чип «Возвращено» на отменённом — args), axe-аудит новой стори в общем прогоне. Поллинг-DTO не расширяется (спека #8).

**Blocked by:** 01

**Status:** resolved

- [x] PaymentChip: «Возвращено»/«Возврат выполняется» — ИСКЛЮЧЕНИЕ из «чип скрыт на отменённых» (ответ на «а деньги?»; «Ожидает оплаты» по-прежнему скрыт)
- [x] Баннеры отмены оплаченного: cancelBannerText(base, paymentStatus) — «— средства вернутся на счёт» (paid, живой setState) / «— возврат выполнен» (refunded, RSC-снапшот); refundState-проп НЕ понадобился — order-level paymentStatus='refunded' доезжает существующим initialPaymentStatus (спека #8 выдержана: DTO не расширялся)
- [x] Dialog отмены оплаченного — «Средства вернутся на счёт.»
- [x] Storybook: сторя RefundedCancelled; axe **104 прогона (52 стори × 2 темы) — 0 нарушений**
- [x] lint/tsc/build-storybook зелёные

## Comments

- 2026-11-19 (реализация): admin `/admin/orders` PaymentBadge — трёхсостояный (Оплачен/Ожидает/**Возврат выполнен**); cancelBannerText живой setState даёт «средства вернутся» (paymentStatus=paid в момент отмены), «возврат выполнен» виден при перезаходе (RSC-снапшот refunded; поллинг замолкает на терминальном — осознанное ограничение спеки #8, e2e P3-4 проверяет оба состояния).
