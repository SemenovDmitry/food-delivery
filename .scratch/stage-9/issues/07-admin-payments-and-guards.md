# 07: Админка — /admin/payments + гварды updateOrderStatus

**What to build:** Страница `/admin/payments` (Q14): гард — как у `/admin/settings` (проверить его зону при реализации и повторить; страница за `connection()`/Suspense-гейтом — §5.33); список провайдеров из `payment_methods` по position: label + Switch-тумблер (`useOptimistic`, toast-откат, паттерн свитчей этапа 5); toggle → UPDATE `is_active`; выключение **последнего** активного — не блок, но тост-предупреждение «Онлайн-оплата станет недоступна» (мягкая деградация Q20); AdminNav += пункт «Оплата» с ролью по гварду страницы. `updateOrderStatus` (Q18/Q21/Q17): **(а)** гвард старта кухни — `paymentMethod = 'online' && paymentStatus = 'pending' && next = 'preparing'` → `{ error: 'Заказ ожидает оплаты' }` (готовые/выдача/доставка у оплаченных онлайн — как обычно; `on_receipt` не гвардится); **(б)** переход в `delivered | picked_up` при `paymentMethod = 'on_receipt' && paymentStatus = 'pending'` → в **той же транзакции** `paymentStatus = 'paid'` (Q21, деньги собраны); **(в)** живой отказ админом неоплаченного онлайн — без изменений → `cancelled_by_vendor` (человек решает — человек и статус). `/admin/orders` UI: для gated-заказов inline select дизейблится с подписью «Ожидает оплаты» (серверный гвард страхует независимо от UI); `StatusBadge`/чипы знают `cancelled_by_timeout` (тикет 01); строка заказа при on_receipt-оплате — бейдж paymentStatus обновится после revalidate (`updateTag('orders')` уже в action).

**Blocked by:** 01, 02

**Status:** open

- [ ] `/admin/payments`: тумблеры работают (оптимистично, откат при ошибке), гард страницы по образцу settings
- [ ] Выключение обоих провайдеров: тост-предупреждение на последнем; в чекауте онлайн исчезает (связка с 04)
- [ ] Гвард «Заказ ожидает оплаты»: action отказывает, select disabled в UI
- [ ] on_receipt → delivered/picked_up: paymentStatus=paid в той же транзакции; БД верифицирована
- [ ] AdminNav содержит новый пункт с корректной ролью
