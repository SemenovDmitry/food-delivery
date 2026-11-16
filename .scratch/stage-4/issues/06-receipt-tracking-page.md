# 06: /orders/[id] — трекинг поверх квитанции + маскирование + loading/error

**What to build:** Rework `(shop)/orders/[id]/page.tsx`: над карточкой квитанции — `OrderTracker` (пропы из RSC: id, order.status, order.fulfillment → 'delivery'|'pickup', order.updatedAt.toISOString()). **Маскирование Q11a**: `const session = await getSession()` (connection()-гейт внутри lib/session.ts уже есть, §5.3), `isOwner = session?.user.id != null && session.user.id === order.userId`; адрес/комментарий — только `isOwner` (иначе muted-строка «Адрес скрыт — виден только владельцу заказа»; комментарий не показываем вовсе); блок «Скопировать ссылку» — у всех (гость без него не surviving). Бейдж статуса в заголовке карточки убрать (дубль таймлайна) или оставить синхронным? — убрать: таймлайн единственный источник статуса на странице (бейдж не умеет обновляться от поллинга). `loading.tsx` (скелетон по паттерну ReceiptSkeleton — мгновенная оболочка при хард-навигации), `error.tsx` (client, reset-кнопка, русский текст; not-found.tsx уже есть). RSC-часть таймлайна не нужна отдельно: OrderTracker рендерит его из initialStatus сам (SSR первого кадра — client component рендерится на сервере). `<main>`-контейнер сохранён (правило «новая страница = контейнер», 7b26115).

**Blocked by:** 04 (трекер), 05 (кнопка отмены внутри трекера)

**Status:** resolved

- [x] OrderTracker над квитанцией, пропы из RSC; fulfillment → 'delivery'|'pickup'
- [x] isOwner-маскирование адреса/комментария; гостевой заказ (userId=null) скрыт для всех
- [x] Copy-link блок у всех; статус-бейдж из заголовка убран (источник — таймлайн)
- [x] loading.tsx + error.tsx (reset), not-found без изменений
- [x] Тоталы/состав/RepeatOrderButton без изменений (снапшот)
