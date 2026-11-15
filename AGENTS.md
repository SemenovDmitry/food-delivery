# AGENTS.md — Food Delivery

> **Канонический документ проекта**: план, статус и конвенции. Единственный источник правды между сессиями — обновлять после каждого этапа (отметить чекбокс, обновить «Текущее состояние», закоммитить).
>
> Блок `nextjs-agent-rules`, если появится в этом файле, не удалять — он пересоздаётся Next.js.

## 1. О проекте

Учебный Food Delivery (по образцу Додо Пицца): **шаурма и пицца** + сеты со скидкой, напитки, десерты. Каждый модуль демонстрирует фичу Next.js 16. Full-stack без отдельного бэкенда.

Зафиксировано:

- UI на русском
- Светлая и тёмная темы — равнозначные
- Доступность WCAG 2.1 AA / EN 301 549 (EU Accessibility Act)
- Учебный, но с прод-практиками: **готов к деплою в Docker в любой момент** (без CI — проект учебный)

## 2. Стек

Next.js 16.4.6 (App Router, Turbopack, Cache Components, Partial Prefetching, React Compiler) · React 19.3 · TypeScript strict · Tailwind v4 + shadcn/ui (radix, preset nova) · **PostgreSQL 17 в docker-compose + Drizzle ORM (pg-core, драйвер postgres-js, миграции drizzle-kit)** · better-auth (email+password, роли admin/customer) · **MinIO (S3-совместимое хранилище; клиент @aws-sdk/client-s3) + sharp (обработка фото)** · AI SDK 7 (`ai` + `@ai-sdk/react` + провайдеры openai/anthropic/google) · next-themes · pnpm.

Решения гриллинга 2026-11-15 (полная картина — §6, §8, §11): **без отдельного бэкенда** — монолит Next.js: чтения RSC напрямую из БД, записи Server Actions, Route Handlers ровно 4; **Postgres вместо SQLite** с этапа 0; **серверная корзина вместо Zustand**; **максимальное кеширование** (§5.3, §6, §11).

## 3. Текущее состояние (обновлено 2026-11-15)

- GitHub: репозиторий привязан — `origin → https://github.com/SemenovDmitry/food-delivery`; кода проекта нет — коммиты только README/.gitignore и AI skills
- **Этап 0 — вариант Б: пересборка с нуля** (решено на гриллинге 2026-11-15). Кандидат А (`E:\repositories\food-ordering`) исключён: это Express+Prisma REST-бэкенд, **другой проект — не трогать**
- Стек переопределён 2026-11-15: Postgres вместо SQLite, серверная корзина вместо Zustand-persist, MinIO + Docker-готовность с этапа 0 — см. §2, §5, §6, §8, §11
- `.gitignore`: `!.env.example` есть; `/data` для SQLite больше не актуальна — volume БД живёт в Docker
- **AI skills (AI Hero)**: 37 навыков mattpocock/skills установлены в `.zcode/skills/` (основное место ZCode) и `.agents/skills/` (для других агентов — VS Code/Copilot) + `skills-lock.json`; конфигурация — `docs/agents/` (трекер — локальные markdown-файлы в `.scratch/`, канонические лейблы триажа, single-context доки); язык домена — `GLOSSARY.md`. ZCode подхватывает навыки в новой сессии

## 4. Демо-данные (после `pnpm db:seed`)

- 5 категорий: Пицца, Шаурма, Сеты, Напитки, Десерты
- 24 товара: 8 пицц (Маргарита 590₽…), 6 шаурм (300–450₽), 3 сета («Шаурма для двоих» 690₽, «Двойная пицца» 1290₽, «Компания» 1990₽ — состав в `set_items`), 4 напитка, 3 десерта; у всех `imageUrl: null` — до этапа 5 показывается emoji-фолбэк
- 4 акции: `SHAWARMA20` −20%, `COMBO150` −150₽, `PIZZA300` −300₽, «Счастливые часы −10%» (без кода, окно дат)
- Аккаунты: **admin** `admin@food.local` / `admin1234` · **клиент** `client@food.local` / `client1234`
- Деньги — в **копейках** (int); вывод через `formatPrice()` из `@/lib/format`

## 5. Технические грабли (обязательны к соблюдению)

1. **Доки Next.js — в пакете**: `node_modules/next/dist/docs/`.
2. **next.config.ts**: `cacheComponents: true`, `partialPrefetching: true`, `reactCompiler: true` (+ dev-dep `babel-plugin-react-compiler`), `output: 'standalone'` (Docker).
3. **Cache Components**: кешируемые async-функции: `'use cache'` + `cacheLife()` + `cacheTag()`; теги: меню → `'menu'`, акции → `'promos'`, заказы → `'orders'`; после мутаций `revalidateTag()`. Доступ к `cookies()`/`searchParams`/`new Date()` — только в некешируемых скоупах, оборачивать в `<Suspense>`. **Аргументы `'use cache'`-функции — часть кеш-ключа**: время внутрь не передавать (уникальный ключ на каждый момент = кеш никогда не срабатывает). **Акции**: кешируются данные (`isActive = true`), окно `startsAt/endsAt` — фильтр на чтении вне кеша; **страница `/promo` целиком не кешируется** — кешируемая оболочка + список в Suspense, иначе отрендеренный список заморозится.
4. **pnpm 11**: одобрение сборок — в `pnpm-workspace.yaml` → секция `allowBuilds` (esbuild: true; better-sqlite3 больше нет — Postgres). Поле `pnpm.onlyBuiltDependencies` в package.json игнорируется.
5. **Drizzle pg-core**: `boolean()` есть; деньги — `integer` (копейки); драйвер postgres-js; `db/index.ts` без mkdir/WAL (это было для SQLite).
6. **ESLint**: jsx-a11y добавлять ТОЛЬКО правилами (`rules: jsxA11y.flatConfigs.recommended.rules`) — `eslint-config-next` уже регистрирует плагин, полная конфигурация даёт «Cannot redefine plugin jsx-a11y».
7. **shadcn 4.x CLI**: `pnpm dlx shadcn@latest init -y -b radix -p nova --css-variables`. Пресет nova ожидает font-переменную `--font-sans` (Geist с cyrillic-сабсетом).
8. **Темы**: next-themes (attribute=class, system); иконки переключателя — обе рендерятся, видимость через `dark:` классы (без mounted-состояния — React Compiler линт против set-state-in-effect).
9. **proxy, не middleware** — `src/proxy.ts` (гард /admin по роли).
10. **Заказ и корзина**: id заказа = uuid (неугадываемый) → трекинг доступен гостю; корзина — серверная (`carts`/`cart_items`), гостю — httpOnly-cookie `cart_id`, при логине слияние; состав заказа берётся из корзины в БД (клиентским спискам не доверять); цены снапшотятся из БД; промокод ревалидируется на сервере; запись в `db.transaction()`.
11. **AI skills (mattpocock/skills)**: файлы — копии в `.zcode/skills/` (читает ZCode) и `.agents/skills/` (читают другие агенты); обновление — `npx skills@latest update`. Конфигурация навыков — `docs/agents/*.md`; термины домена — только через `GLOSSARY.md`. Трекер — локальные markdown-файлы (`.scratch/<feature>/`): `gh` CLI не нужен, спеки и тикеты коммитятся вместе с этапом. `.zcode/skills` важнее `.agents/skills` при обнаружении — копии идентичны, конфликта нет.
12. **Миграции**: только drizzle-kit (`generate`/`migrate`), SQL-файлы коммитятся в репозиторий; `db:push` не используем.
13. **Docker**: multi-stage Dockerfile (pnpm, standalone); дисциплина этапа — перед коммитом `docker build` проходит и `docker compose up` поднимается.
14. **ETag**: `GET /api/orders/[id]` — 304 при неизменном статусе (polling экономит тело ответа, свежесть сохраняется); `GET /api/promotions` — ETag + `Cache-Control: public, s-maxage`. Клиентский кеш страниц — Router Cache, работает сам через `cacheComponents` + `partialPrefetching`.

## 6. План работ

### Этап 0 — базовая кодовая база (вариант Б — пересборка с нуля, решено 2026-11-15)

- [ ] create-next-app (Next 16.4, TS strict, Tailwind v4, `src/`, pnpm)
- [ ] `allowBuilds` в pnpm-workspace.yaml; конфиги (next с `output: 'standalone'`/eslint/drizzle pg/`.env.example`: DATABASE_URL, S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET, AUTH_SECRET, AI-ключи); CLAUDE.md (→ указатель на AGENTS.md); README.md (roadmap обучения)
- [ ] Docker: multi-stage Dockerfile (pnpm, standalone), `docker-compose.dev.yml` (postgres:17 + minio), `docker-compose.prod.yml` (app + postgres + minio)
- [ ] shadcn init (radix/nova) + компоненты: button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch
- [ ] Схема Drizzle pg-core + `db/index.ts` (postgres-js) + миграции drizzle-kit (SQL в git) + идемпотентный сидер
- [ ] better-auth: `lib/auth.ts` (роли, cookieCache 5 мин), `auth-client.ts`, `session.ts` (getSession/getAdminSession), `/api/auth/[...all]`
- [ ] `lib/format.ts` (formatPrice, formatDate, formatDateTime, STATUS_LABELS); queries: `getFullMenu`/`getProduct` (тег `menu`), `getActivePromotions` (кеш данных + окно на чтении, тег `promos`), orders без кеша; actions: корзина — add/setQty/remove (гостевая httpOnly cookie `cart_id`), `createOrder`, `applyPromoCode`
- [ ] Каркас магазина: layout (lang=ru, skip-link, ThemeProvider, Toaster, Geist latin+cyrillic), header/footer, product-card/details, promo-card; маршруты `/`, `/menu`, `/product/[id]`, `@modal` (intercepting → модалка)
- [ ] Проверка: lint чист, `db:seed` идемпотентен, `GET /` → 200, `docker build` проходит, `docker compose up` поднимается; точные значения профилей `cacheLife` сверены с `node_modules/next/dist/docs/`
- [ ] Коммит «Этап 0»

### Этап 1 — Корзина и чекаут (серверная корзина)

- [ ] `(shop)/cart/page.tsx` + CartView: список из БД, степперы (`useOptimistic` + server actions), промокод (`applyPromoCode` + `useTransition`), предзаполнение из `?promo=`, тоталы в `aria-live`
- [ ] Гостевая корзина: httpOnly-cookie `cart_id` при первом добавлении товара
- [ ] Бейдж корзины в header — динамический фрагмент в Suspense (shell остаётся кешируемым)
- [ ] `(shop)/checkout/page.tsx` + CheckoutForm: name/phone/fulfillment/address/comment → `createOrder` (состав из корзины в БД) → `router.push(/orders/${id})`
- **Готово, когда**: «2×Пепперони + сет → SHAWARMA20 → заказ создан», корзина переживает перезагрузку и логин

### Этап 2 — Акции

- [ ] `(shop)/promo/page.tsx`: кешируемая оболочка + список в Suspense (целиком НЕ кешируется), PromoCard
- [ ] `GET /api/promotions` — ETag + `Cache-Control: public, s-maxage`
- **Готово, когда**: 4 акции из сидера видны на `/promo` и в API; акция исчезает ровно в конце окна, без вмешательства в кеш

### Этап 3 — Auth + история заказов

- [ ] `(auth)/login`, `(auth)/register` (better-auth email/password, формы с aria-ошибками)
- [ ] Слияние гостевой корзины с пользовательской при входе
- [ ] `(shop)/orders/page.tsx` (история, гард по сессии)
- **Готово, когда**: вход обоими демо-аккаунтами, история видна только владельцу, гостевая корзина доехала до аккаунта

### Этап 4 — Трекинг заказа

- [ ] `(shop)/orders/[id]/page.tsx`: таймлайн статусов (иконка+текст, не только цвет)
- [ ] `GET /api/orders/[id]` + ETag (304 при неизменном статусе) + polling ~5 с; `loading.tsx`, `not-found.tsx`, `error.tsx`
- **Готово, когда**: гость по uuid-ссылке видит статус, обновляющийся без перезагрузки

### Этап 5 — Админка + картинки

- [ ] `lib/actions/products.ts` + `promotions.ts` + `updateOrderStatus` (requireAdmin через getAdminSession, revalidateTag)
- [ ] Картинки: S3-клиент через env (`S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET`), upload — FormData → sharp → PutObject; `next/image` + `remotePatterns` на endpoint; emoji — фолбэк при пустом `imageUrl`
- [ ] `/admin` (заказы, useOptimistic + смена статуса), `/admin/products` (CRUD single+set, редактор состава, upload фото), `/admin/promotions`
- [ ] `src/proxy.ts` — гард /admin по роли (matcher)
- **Готово, когда**: гость на `/admin` → редирект; CRUD сета с составом работает; фото загружается и показывается на карточке; смена статуса мгновенно видна на трекинге

### Этап 6 — AI-ассистент (независим от этапов 1–5, можно двигать)

- [ ] `lib/ai.ts`: `getModel()` выбирает провайдера по ключу (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY), понятная ошибка без ключей
- [ ] `POST /api/chat`: streamToResponse, tools `searchMenu` (из getFullMenu) + клиентский `addToCart` (вызывает server action корзины)
- [ ] `(shop)/assistant/page.tsx`: useChat, ARIA chat roles
- **Готово, когда**: без ключей понятная ошибка; с ключом ассистент ищет по меню и добавляет в корзину

### Этап 7 — Верификация

- [ ] `pnpm lint` + `pnpm build`
- [ ] Браузерный сценарий: главная → меню → модалка → сет в корзину → SHAWARMA20 → чекаут → трекинг; смена статуса в админке → трекинг обновился; создание акции/сета в админке; гость на `/admin` → редирект; `/assistant` без ключа → понятная ошибка
- [ ] Lighthouse a11y ≥ 95 в обеих темах; клавиатурный проход
- **Готово, когда**: всё выше проходит, найденное исправлено

### Этап 8 — Git

- [ ] Коммит на каждый этап, push в `origin/master`

## 7. A11y-чек-лист (на каждый модуль)

- Landmarks, один h1, skip-link (в layout)
- Клавиатурность + focus-visible; фокус-ловушка модалок (Dialog)
- label + aria-invalid + aria-describedby
- Статус — не только цветом; emoji — `aria-hidden`
- Динамика через aria-live; prefers-reduced-motion
- Только CSS-токены (`bg-background`/`text-foreground` и т.п.)
- Контраст ≥ 4.5:1 в обеих темах

## 8. Функциональная спецификация (кратко)

- **Happy path клиента**: главная (hero + акции + популярное) → меню (фильтры category/q через searchParams) → модалка товара (intercepting route) → корзина (серверная: `carts`/`cart_items`; гостю — httpOnly cookie `cart_id`, при логине слияние) → промокод (поле на корзине) → чекаут (контакты; состав берётся из БД) → заказ (uuid) → трекинг `новый → подтверждён → готовится → в пути → доставлен` (+ `отменён`), polling ~5 с (ETag → 304)
- **API**: Route Handlers — ровно 4: `GET /api/orders/[id]`, `GET /api/promotions`, `POST /api/chat`, `/api/auth/[...all]` (sign-up/email, sign-in/email, sign-out, get-session). Server Actions — корзина (add/setQty/remove), `createOrder`, `applyPromoCode`, `updateOrderStatus`, CRUD products (вкл. set_items)/categories/promotions. Каталог/акции/заказы читаются в RSC из БД напрямую, без HTTP.
- **Каталог**: `type single|set`, состав сетов в `set_items`, выгода — зачёркнутая старая цена, фото из MinIO (`imageUrl`) или emoji-фолбэк

## 9. Roadmap после MVP

Оплаты, модификаторы (размер/тесто), повтор заказа, автопрогресс статусов, автотесты (vitest + Playwright), managed Postgres при serverless-переезде, managed S3/R2 вместо MinIO.

## 10. Правила ведения этого файла

1. После завершения этапа: отметить чекбоксы `[x]`, обновить раздел 3 «Текущее состояние», закоммитить.
2. Новые решения и грабли дописывать в раздел 5, не удаляя старые.
3. Этот файл — источник правды; чат и память агента — только указатели на него.

## 11. Приложение — состав базовой кодовой базы (детальная спецификация, вариант Б)

**Корень:** next.config.ts (cacheComponents, partialPrefetching, reactCompiler, `output: 'standalone'`), eslint.config.mjs, drizzle.config.ts (dialect postgres), pnpm-workspace.yaml (allowBuilds: esbuild), .env.example (DATABASE_URL, S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET, AUTH_SECRET, AI-ключи), Dockerfile (multi-stage, pnpm, standalone), docker-compose.dev.yml (postgres:17 + minio), docker-compose.prod.yml (app + postgres + minio), CLAUDE.md (→ указатель на AGENTS.md), README.md (roadmap обучения).

**`src/app/layout.tsx`:** lang="ru", skip-to-content, ThemeProvider, Toaster, Geist (latin+cyrillic, переменная `--font-sans`).

**Auth:** `api/auth/[...all]/route.ts` — better-auth handler (toNextJsHandler); `lib/auth.ts` (betterAuth + drizzleAdapter, role additionalField с `input: false`, cookieCache 5 мин); `lib/auth-client.ts`; `lib/session.ts` (getSession, getAdminSession); `lib/format.ts` (formatPrice, formatDate, formatDateTime, STATUS_LABELS). Гостевая корзина — httpOnly-cookie `cart_id` (uuid); при логине — слияние в пользовательскую.

**БД (pg-core):** `db/schema.ts` — user/session/account/verification + categories, products (type single|set, emoji, `imageUrl` nullable, price в копейках int), set_items, promotions (discountType percent|fixed, code nullable, startsAt/endsAt, isActive), carts (uuid, user_id nullable, promo_id nullable, timestamps), cart_items (cart_id, product_id, qty, уникальность пары), orders (uuid, status, fulfillment, promoId, discountAmount), order_items (снапшот); типы + `ORDER_STATUSES`. `db/index.ts` — postgres-js. Миграции — drizzle-kit, SQL-файлы в git. `db/seed.ts` — идемпотентный.

**Запросы:** `queries/menu.ts` — `getFullMenu()` (`'use cache'` + `cacheLife('hours')` + тег `'menu'`): категории+товары+составы сетов, тип `MenuProduct` c setComponents/setOldPrice; `getProduct(id)`. `queries/promotions.ts` — `getCachedActivePromotions()` (`'use cache'` + `cacheLife('hours')` + тег `'promos'`, фильтр isActive — данные без времени) + обёртка `getActivePromotions()` без кеша: `new Date()` + фильтр окна startsAt/endsAt на каждом чтении. `queries/cart.ts` — `getCart(cartId)` — динамика, без `'use cache'` (персональные данные). `queries/orders.ts` — без кеша: `getOrderById`, `getUserOrders`, `getAllOrders`.

**Действия:** `actions/cart.ts` (`'use server'`): addToCart/setQty/removeFromCart — cookie гостя либо корзина пользователя, пересчёт инвалидирует через revalidate текущего маршрута. `actions/orders.ts` (`'use server'`): `createOrder(payload)` — только контакты; состав из корзины в БД, снапшот цен из БД, ревалидация промокода, транзакция, `revalidateTag('orders')`, результат `{ ok, data: { orderId } }`; `applyPromoCode(code)` — валидация, promo_id на корзину. Тип `ActionResult<T>`.

**Компоненты:** theme-provider, theme-toggle; `shop/`: header (клиентский: навигация Меню/Акции/Ассистент, ThemeToggle, AuthArea на useSession, CartButton — бейдж как динамический фрагмент в Suspense), footer, add-to-cart-button (server action + useOptimistic + toast), product-card (серверный: бейдж выгоды, зачёркнутая старая цена, `<Image>` по imageUrl или emoji-фолбэк), product-details (клиентский: режим модалки asDialog через router.back() + режим страницы, степпер количества), promo-card (+formatDiscount).

**Маршруты:** `(shop)/layout.tsx` (рендерит `{children}` + `{modal}`); `(shop)/page.tsx` (hero + «Акции недели» в Suspense + «Популярное»); `(shop)/menu/page.tsx` (searchParams в Suspense; MenuFilters — серверный, нативная GET-форма поиска + пилюли категорий; группировка по категориям); `(shop)/@modal/default.tsx`; `(shop)/@modal/(.)product/[id]/page.tsx` (intercepting → модалка); `(shop)/product/[id]/page.tsx` (fallback + generateMetadata).

**Компоненты shadcn:** button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch.

## Agent skills

### Issue tracker

Issues — локальные markdown-файлы в `.scratch/<feature-slug>/`: спека — `spec.md`, тикеты — `issues/NN-<slug>.md` с `Status:` и `Blocked by:` строками. См. `docs/agents/issue-tracker.md`.

### Triage labels

Канонические лейблы без переименований: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` в корне + ADR в `docs/adr/` (создаются лениво). См. `docs/agents/domain.md`.
