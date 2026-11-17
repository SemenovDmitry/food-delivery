# 07: Админка — /admin/payments + гварды updateOrderStatus

**What to build:** Страница `/admin/payments` (Q14): гард — как у `/admin/settings` (проверить его зону при реализации и повторить; страница за `connection()`/Suspense-гейтом — §5.33); список провайдеров из `payment_methods` по position: label + Switch-тумблер (`useOptimistic`, toast-откат, паттерн свитчей этапа 5); toggle → UPDATE `is_active`; выключение **последнего** активного — не блок, но тост-предупреждение «Онлайн-оплата станет недоступна» (мягкая деградация Q20); AdminNav += пункт «Оплата» с ролью по гварду страницы. `updateOrderStatus` (Q18/Q21/Q17): **(а)** гвард старта кухни — `paymentMethod = 'online' && paymentStatus = 'pending' && next = 'preparing'` → `{ error: 'Заказ ожидает оплаты' }` (готовые/выдача/доставка у оплаченных онлайн — как обычно; `on_receipt` не гвардится); **(б)** переход в `delivered | picked_up` при `paymentMethod = 'on_receipt' && paymentStatus = 'pending'` → в **той же транзакции** `paymentStatus = 'paid'` (Q21, деньги собраны); **(в)** живой отказ админом неоплаченного онлайн — без изменений → `cancelled_by_vendor` (человек решает — человек и статус). `/admin/orders` UI: для gated-заказов inline select дизейблится с подписью «Ожидает оплаты» (серверный гвард страхует независимо от UI); `StatusBadge`/чипы знают `cancelled_by_timeout` (тикет 01); строка заказа при on_receipt-оплате — бейдж paymentStatus обновится после revalidate (`updateTag('orders')` уже в action).

**Blocked by:** 01, 02

**Status:** resolved

- [x] `/admin/payments` в `(admin-only)`: тумблеры Switch (useOptimistic, toast-откат, идемпотентный conditional UPDATE), гард requireAdminOnly — curl без сессии → 307 /login
- [x] Выключение последнего активного: toast.warning «Онлайн-оплата станет недоступна»; в чекауте онлайн исчезает — связка с 04 (hasActiveProviders), браузерная проверка — приёмка 08
- [x] Гвард «Заказ ожидает оплаты»: action отказывает (online+pending → preparing запрещён; отмены не гвардятся — живой отказ работает), select disabled + подпись «Ожидает оплаты» (aria-label, title)
- [x] on_receipt → delivered/picked_up: paymentStatus=paid в ТОЙ ЖЕ транзакции updateOrderStatus (conditional UPDATE гасит гонку)
- [x] AdminNav += «Оплата» (adminOnly: true — как настройки: влияет на чекаут магазина)
