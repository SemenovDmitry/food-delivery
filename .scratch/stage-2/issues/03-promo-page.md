# 03: Страница /promo

**What to build:** `(shop)/promo/page.tsx`: кешируемая оболочка + список в Suspense (страница целиком НЕ кешируется — AGENTS §6 этап 2). Сетка PromoCard как есть. Ссылки «Акции» (шапка) и «все →» (главная) перестают быть мёртвыми.

**Blocked by:** 02

**Status:** resolved

- [x] `src/app/(shop)/promo/page.tsx` — в группе (shop): шапка/подвал/skip-link из layout
- [x] Кешируемая оболочка: h1 «Акции» (один h1 на страницу), `export const metadata` (title «Акции — Food Delivery»), контейнер `max-w-6xl px-4` (правило 7b26115: новая страница = контейнер)
- [x] Список в Suspense: компонент с `await connection()` ПЕРВЫМ (§5.3) → `getActivePromotions()` (окно — фильтр на чтении, поэтому список не замораживается в кеше); fallback-скелет по образцу PromosSkeleton главной
- [x] Сетка `PromoCard` как есть: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (как карточки товаров); карточка сообщает скидку + код/«без кода» + срок; без кнопок «Применить» (тизер — применение живёт в корзине, блок акций /cart)
- [x] Пустое состояние: «Сейчас активных акций нет» (text-muted-foreground, по образцу главной)
- [x] a11y-чек-лист §7: main-landmark (в layout группы, если там main — проверить), один h1, только CSS-токены, контраст в обеих темах; emoji на карточках — нет (PromoCard без emoji)
