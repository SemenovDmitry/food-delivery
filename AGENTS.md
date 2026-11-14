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

## 2. Стек

Next.js 16.4.6 (App Router, Turbopack, Cache Components, Partial Prefetching, React Compiler) · React 19.3 · TypeScript strict · Tailwind v4 + shadcn/ui (radix, preset nova) · Drizzle ORM + better-sqlite3 (SQLite) · better-auth (email+password, роли admin/customer) · Zustand (корзина) · AI SDK 7 (`ai` + `@ai-sdk/react` + провайдеры openai/anthropic/google) · next-themes · pnpm.

## 3. Текущее состояние (обновлено 2026-11-14)

- GitHub: репозиторий создан и привязан — `origin → https://github.com/SemenovDmitry/food-delivery`, единственный коммит `ad16534 "Initial commit"` (только `README.md` + `.gitignore`)
- **Кода проекта в репозитории нет** — этап 0 не выполнен
- `.gitignore`: `!.env.example` есть; `/data` (SQLite) — добавить на этапе 0
- Ветка этапа 0 не выбрана: **А** (перенос существующего кода; кандидат — `E:\repositories\food-ordering`, не проверялся) или **Б** (пересборка с нуля по этому документу)
- **AI skills (AI Hero)**: 37 навыков mattpocock/skills установлены в `.zcode/skills/` (основное место ZCode) и `.agents/skills/` (для других агентов — VS Code/Copilot) + `skills-lock.json`; конфигурация — `docs/agents/` (трекер GitHub Issues, канонические лейблы триажа, single-context доки); язык домена — `GLOSSARY.md`. ZCode подхватывает навыки в новой сессии

## 4. Демо-данные (после `pnpm db:seed`)

- 5 категорий: Пицца, Шаурма, Сеты, Напитки, Десерты
- 24 товара: 8 пицц (Маргарита 590₽…), 6 шаурм (300–450₽), 3 сета («Шаурма для двоих» 690₽, «Двойная пицца» 1290₽, «Компания» 1990₽ — состав в `set_items`), 4 напитка, 3 десерта
- 4 акции: `SHAWARMA20` −20%, `COMBO150` −150₽, `PIZZA300` −300₽, «Счастливые часы −10%» (без кода)
- Аккаунты: **admin** `admin@food.local` / `admin1234` · **клиент** `client@food.local` / `client1234`
- Деньги — в **копейках** (int); вывод через `formatPrice()` из `@/lib/format`

## 5. Технические грабли (обязательны к соблюдению)

1. **Доки Next.js — в пакете**: `node_modules/next/dist/docs/`.
2. **next.config.ts**: `cacheComponents: true`, `partialPrefetching: true`, `reactCompiler: true` (+ dev-dep `babel-plugin-react-compiler`).
3. **Cache Components**: кешируемые async-функции: `'use cache'` + `cacheLife()` + `cacheTag()`; теги: меню → `'menu'`, акции → `'promos'`, заказы → `'orders'`; после мутаций `revalidateTag()`. Доступ к `cookies()`/`searchParams` — только в некешируемых скоупах, оборачивать в `<Suspense>`.
4. **pnpm 11**: одобрение сборок — в `pnpm-workspace.yaml` → секция `allowBuilds` (better-sqlite3: true, esbuild: true). Поле `pnpm.onlyBuiltDependencies` в package.json игнорируется.
5. **Drizzle sqlite-core**: НЕТ `boolean()` — использовать `integer("col", { mode: "boolean" })`.
6. **ESLint**: jsx-a11y добавлять ТОЛЬКО правилами (`rules: jsxA11y.flatConfigs.recommended.rules`) — `eslint-config-next` уже регистрирует плагин, полная конфигурация даёт «Cannot redefine plugin jsx-a11y».
7. **shadcn 4.x CLI**: `pnpm dlx shadcn@latest init -y -b radix -p nova --css-variables`. Пресет nova ожидает font-переменную `--font-sans` (Geist с cyrillic-сабсетом).
8. **Темы**: next-themes (attribute=class, system); иконки переключателя — обе рендерятся, видимость через `dark:` классы (без mounted-состояния — React Compiler линт против set-state-in-effect).
9. **proxy, не middleware** — `src/proxy.ts` (гард /admin по роли).
10. **Заказ**: id = uuid (неугадываемый) → трекинг доступен гостю; цены снапшотятся из БД (клиентским ценам не доверять); промокод ревалидируется на сервере; запись в `sqlite.transaction()`.
11. **AI skills (mattpocock/skills)**: файлы — копии в `.zcode/skills/` (читает ZCode) и `.agents/skills/` (читают другие агенты); обновление — `npx skills@latest update`. Конфигурация навыков — `docs/agents/*.md`; термины домена — только через `GLOSSARY.md`. Навыкам `/to-spec`, `/to-tickets`, `/triage` нужен `gh` CLI (на 2026-11-14 не установлен — установить при первом использовании). `.zcode/skills` важнее `.agents/skills` при обнаружении — копии идентичны, конфликта нет.

## 6. План работ

### Этап 0 — базовая кодовая база (решение А/Б не выбрано)

**Вариант А — перенос существующего кода** (если найдётся каталог; кандидат `E:\repositories\food-ordering`):

- [ ] Перенести файлы (исключая `.git`, `node_modules`, `.next`, `data/`), сохранив привязку к GitHub
- [ ] `pnpm install` → `pnpm db:seed` → `pnpm lint` → smoke dev-сервера (`GET /` → 200)

**Вариант Б — пересборка с нуля** (по разделам 1–5, 8):

- [ ] create-next-app (Next 16.4, TS strict, Tailwind v4, `src/`, pnpm)
- [ ] `allowBuilds` в pnpm-workspace.yaml; конфиги (next/eslint/drizzle/`.env.example`); CLAUDE.md (→ указатель на AGENTS.md); README.md (roadmap обучения)
- [ ] shadcn init (radix/nova) + компоненты: button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch
- [ ] Схема Drizzle + `db/index.ts` (WAL, foreign_keys) + идемпотентный сидер
- [ ] better-auth: `lib/auth.ts` (роли, cookieCache 5 мин), `auth-client.ts`, `session.ts` (getSession/getAdminSession), `/api/auth/[...all]`
- [ ] `lib/format.ts` (formatPrice, formatDate, STATUS_LABELS); queries: `getFullMenu`/`getProduct` (тег `menu`), `getActivePromotions` (тег `promos`), orders без кеша; actions: `createOrder`, `applyPromoCode`
- [ ] Zustand-корзина (persist `food-cart`, `hydrated`)
- [ ] Каркас магазина: layout (lang=ru, skip-link, ThemeProvider, Toaster, Geist latin+cyrillic), header/footer, product-card/details, promo-card; маршруты `/`, `/menu`, `/product/[id]`, `@modal` (intercepting → модалка)

Общее для А/Б:

- [ ] `/data` в `.gitignore`
- [ ] Проверка: lint чист, `db:seed` идемпотентен, `GET /` → 200
- [ ] Коммит «Этап 0»

### Этап 1 — Корзина и чекаут

- [ ] `(shop)/cart/page.tsx` + CartView: список, степперы, промокод (`applyPromoCode` + `useTransition`), предзаполнение из `?promo=`, тоталы в `aria-live`
- [ ] `(shop)/checkout/page.tsx` + CheckoutForm: name/phone/fulfillment/address/comment → `createOrder` → `clear()` → `router.push(/orders/${id})`
- **Готово, когда**: «2×Пепперони + сет → SHAWARMA20 → заказ создан», корзина переживает перезагрузку

### Этап 2 — Акции

- [ ] `(shop)/promo/page.tsx` ('use cache', PromoCard)
- [ ] `GET /api/promotions`
- **Готово, когда**: 4 акции из сидера видны на `/promo` и в API

### Этап 3 — Auth + история заказов

- [ ] `(auth)/login`, `(auth)/register` (better-auth email/password, формы с aria-ошибками)
- [ ] `(shop)/orders/page.tsx` (история, гард по сессии)
- **Готово, когда**: вход обоими демо-аккаунтами, история видна только владельцу

### Этап 4 — Трекинг заказа

- [ ] `(shop)/orders/[id]/page.tsx`: таймлайн статусов (иконка+текст, не только цвет)
- [ ] `GET /api/orders/[id]` + polling ~5 с; `loading.tsx`, `not-found.tsx`, `error.tsx`
- **Готово, когда**: гость по uuid-ссылке видит статус, обновляющийся без перезагрузки

### Этап 5 — Админка

- [ ] `lib/actions/products.ts` + `promotions.ts` + `updateOrderStatus` (requireAdmin через getAdminSession, revalidateTag)
- [ ] `/admin` (заказы, useOptimistic + смена статуса), `/admin/products` (CRUD single+set, редактор состава), `/admin/promotions`
- [ ] `src/proxy.ts` — гард /admin по роли (matcher)
- **Готово, когда**: гость на `/admin` → редирект; CRUD сета с составом работает; смена статуса мгновенно видна на трекинге

### Этап 6 — AI-ассистент (независим от этапов 1–5, можно двигать)

- [ ] `lib/ai.ts`: `getModel()` выбирает провайдера по ключу (OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_API_KEY), понятная ошибка без ключей
- [ ] `POST /api/chat`: streamToResponse, tools `searchMenu` (из getFullMenu) + клиентский `addToCart` (пишет в zustand)
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

- **Happy path клиента**: главная (hero + акции + популярное) → меню (фильтры category/q через searchParams) → модалка товара (intercepting route) → корзина (localStorage persist) → промокод → чекаут → заказ (uuid) → трекинг `новый → подтверждён → готовится → в пути → доставлен` (+ `отменён`), polling ~5 с
- **API**: Route Handlers — `GET /api/orders/[id]`, `GET /api/promotions`, `POST /api/chat`, `/api/auth/[...all]` (sign-up/email, sign-in/email, sign-out, get-session). Server Actions — `createOrder`, `applyPromoCode`, `updateOrderStatus`, CRUD products (вкл. set_items)/categories/promotions. Каталог/акции/заказы читаются в RSC из БД напрямую, без HTTP.
- **Каталог**: `type single|set`, состав сетов в `set_items`, выгода — зачёркнутая старая цена

## 9. Roadmap после MVP

Оплаты, модификаторы (размер/тесто), повтор заказа, автопрогресс статусов, фото вместо emoji, Postgres для деплоя.

## 10. Правила ведения этого файла

1. После завершения этапа: отметить чекбоксы `[x]`, обновить раздел 3 «Текущее состояние», закоммитить.
2. Новые решения и грабли дописывать в раздел 5, не удаляя старые.
3. Этот файл — источник правды; чат и память агента — только указатели на него.

## 11. Приложение — состав базовой кодовой базы (детальная спецификация для варианта 0Б)

**Корень:** next.config.ts, eslint.config.mjs, drizzle.config.ts, pnpm-workspace.yaml, .env.example, CLAUDE.md (→ указатель на AGENTS.md), README.md (roadmap обучения).

**`src/app/layout.tsx`:** lang="ru", skip-to-content, ThemeProvider, Toaster, Geist (latin+cyrillic, переменная `--font-sans`).

**Auth:** `api/auth/[...all]/route.ts` — better-auth handler (toNextJsHandler); `lib/auth.ts` (betterAuth + drizzleAdapter, role additionalField с `input: false`, cookieCache 5 мин); `lib/auth-client.ts`; `lib/session.ts` (getSession, getAdminSession); `lib/format.ts` (formatPrice, formatDate, formatDateTime, STATUS_LABELS).

**БД:** `db/schema.ts` — user/session/account/verification + categories, products (type single|set, emoji, price в копейках), set_items, promotions (discountType percent|fixed, code nullable, startsAt/endsAt, isActive), orders (uuid, status, fulfillment, promoId, discountAmount), order_items (снапшот); типы + `ORDER_STATUSES`. `db/index.ts` — better-sqlite3, mkdir `data/`, WAL, foreign_keys. `db/seed.ts` — идемпотентный.

**Запросы:** `queries/menu.ts` — `getFullMenu()` (`'use cache'` + `cacheLife('hours')` + тег `'menu'`): категории+товары+составы сетов, тип `MenuProduct` c setComponents/setOldPrice; `getProduct(id)`. `queries/promotions.ts` — `getActivePromotions()` (`'use cache'` + `cacheLife('minutes')` + тег `'promos'`, фильтр isActive + окно дат). `queries/orders.ts` — без кеша: `getOrderById`, `getUserOrders`, `getAllOrders`.

**Действия:** `actions/orders.ts` (`'use server'`): `createOrder(payload)` — валидация, снапшот цен из БД, ревалидация промокода, транзакция, `revalidateTag('orders')`, результат `{ ok, data: { orderId } }`; `applyPromoCode(code)`. Тип `ActionResult<T>`.

**Корзина:** `stores/cart.ts` — zustand + persist(`'food-cart'`): items, promo, `hydrated` (через onRehydrateStorage); методы add/setQty/remove/setPromo/clear; селекторы `cartSubtotal()`, `promoDiscount()`.

**Компоненты:** theme-provider, theme-toggle; `shop/`: header (клиентский: навигация Меню/Акции/Ассистент, ThemeToggle, AuthArea на useSession, CartButton с бейджем), footer, add-to-cart-button (toast), product-card (серверный: бейдж выгоды, зачёркнутая старая цена), product-details (клиентский: режим модалки asDialog через router.back() + режим страницы, степпер количества), promo-card (+formatDiscount).

**Маршруты:** `(shop)/layout.tsx` (рендерит `{children}` + `{modal}`); `(shop)/page.tsx` (hero + «Акции недели» в Suspense + «Популярное»); `(shop)/menu/page.tsx` (searchParams в Suspense; MenuFilters — серверный, нативная GET-форма поиска + пилюли категорий; группировка по категориям); `(shop)/@modal/default.tsx`; `(shop)/@modal/(.)product/[id]/page.tsx` (intercepting → модалка); `(shop)/product/[id]/page.tsx` (fallback + generateMetadata).

**Компоненты shadcn:** button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch.

## Agent skills

### Issue tracker

Issues — в GitHub Issues этого репо (операции через `gh` CLI). См. `docs/agents/issue-tracker.md`.

### Triage labels

Канонические лейблы без переименований: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` в корне + ADR в `docs/adr/` (создаются лениво). См. `docs/agents/domain.md`.
