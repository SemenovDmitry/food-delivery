# 04: /admin/orders — список с фильтром, пагинацией, inline-сменой статуса

**What to build:** Query (uncached — заказы без `'use cache'`, §5.3): список всех заказов, фильтр `?status=` (чипы: все / активные / терминальные / конкретный статус; server-фильтр в WHERE), сортировка новые сверху, пагинация `?page=` + `?perPage=` (10/25/50, default 25, zod-парс searchParams) — limit/offset + count. Строка таблицы: № (slice 8), время, имя, телефон, fulfillment, Σшт + сумма, `paymentStatus`-бейдж **read-only** (переворот — webhook этапа 9), `StatusBadge`. Смена статуса — select прямо в строке: опции = `nextStatuses(status, fulfillment)` (пусто → select disabled), клиентский контрол с `useOptimistic` (паттерн степперов корзины), вызов `updateOrderStatus`, ошибка → toast + откат оптимистики (Q22: live-обновлений нет — чужие правки видны при навигации/фильтре/пагинации). Пейджер «← 1 2 3 →» — shadcn `pagination` через CLI, если реестр недоступен (прецедент alert-dialog этапа 4) — руками на Button. aria-live на смене статуса строки.

**Blocked by:** 03

**Status:** resolved

- [ ] Query: фильтр + пагинация + count
- [ ] Чипы `?status=` (searchParams, RSC)
- [ ] Строка: бейджи, select легальных статусов + useOptimistic + toast-откат
- [ ] Пейджер + perPage-селектор
- [ ] Приёмка: смена статуса → трекинг покупателя обновился ≤25 с (ETag 304/200 в Network)
