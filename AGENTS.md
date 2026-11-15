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
- Production-ready-похожий на бесплатных заглушках (гриллинг 2026-11-15): SMS — фейк-код `1111` + консоль, email — SMTP → Mailpit, оплата — мок-провайдер с webhook-контрактом; настоящий провайдер = новый файл + env, без переделки логики
- Пакетный менеджер — **pnpm 11**; npm/yarn не используем

## 2. Стек

Next.js 16.4.6 (App Router, Turbopack, Cache Components, Partial Prefetching, React Compiler) · React 19.3 · TypeScript strict · Tailwind v4 + shadcn/ui (radix, preset nova) · **PostgreSQL 17 в docker-compose + Drizzle ORM (pg-core, драйвер postgres-js, миграции drizzle-kit)** · better-auth (phone-number plugin: регистрация/вход по телефону с SMS-OTP, email-верификация кодом из письма; роли admin/manager/customer) · **MinIO (S3-совместимое хранилище; клиент @aws-sdk/client-s3) + sharp (обработка фото)** · AI SDK 7 (`ai` + `@ai-sdk/react` + провайдеры openai/anthropic/google) · next-themes · nodemailer (SMTP → Mailpit) · pino (структурные логи) · zod (валидация env) · пакетный менеджер **pnpm 11** (pnpm-workspace.yaml с `allowBuilds`; npm/yarn не используем).

Решения гриллинга 2026-11-15 (полная картина — §6, §8, §11): **без отдельного бэкенда** — монолит Next.js: чтения RSC напрямую из БД, записи Server Actions, Route Handlers ровно 6 (+ payment-webhook, + health); **Postgres вместо SQLite** с этапа 0; **серверная корзина вместо Zustand**; **максимальное кеширование** (§5.3, §6, §11); **production-ready-заглушки** (вторая сессия гриллинга 2026-11-15): auth по телефону + верифицируемый email, 8 статусов, PaymentProvider + payments + webhook, аутбокс `notifications` + SMS «заказ готов», автоджоба статусов, ops-харднинг — этапы 9–11 в §6, грабли §5.15–18, детали §11.

## 3. Текущее состояние (обновлено 2026-11-15)

- GitHub: репозиторий привязан — `origin → https://github.com/SemenovDmitry/food-delivery`; кода проекта нет — коммиты только README/.gitignore и AI skills
- **Этап 0 — вариант Б: пересборка с нуля** (решено на гриллинге 2026-11-15). Кандидат А (`E:\repositories\food-ordering`) исключён: это Express+Prisma REST-бэкенд, **другой проект — не трогать**
- Стек переопределён 2026-11-15: Postgres вместо SQLite, серверная корзина вместо Zustand-persist, MinIO + Docker-готовность с этапа 0 — см. §2, §5, §6, §8, §11
- Auth переопределён гриллингом 2026-11-15: email+password не используются — **вход по телефону** (SMS-OTP, фейк-код `1111`), регистрация email + phone, email верифицируется случайным кодом из письма (Mailpit в dev-компоузе); рассылка акций — задел в §9 — см. §5.15, §6 этап 3
- Роутинг и роли (2026-11-15): **меню — на главной `/`** (отдельного `/menu` нет); модалка товара открывается по ссылке `/product/[id]` с главной (intercepting); роли **admin/manager/customer**; закрытые зоны: `/admin/*` — admin+manager (внутри: `/admin/orders` — оба, `/admin/products|promotions|users` — admin; финально — при описании layout), `/orders` и `/orders/[id]` — владелец по сессии (uuid-ссылка для гостя остаётся); этап 9 — **мок-оплата с webhook-контрактом**, этап 10 — аутбокс-уведомления + автоджоба статусов, этап 11 — ops-харднинг (зафиксировано гриллингом 2026-11-15, §6)
- **Этап 0 ЗАВЕРШЁН 2026-11-15**: каркас магазина работает (меню на главной: «Акции недели» + sticky-навигация с якорным скроллом/scrollspy + поиск `?q`, модалка товара intercepting, серверная корзина с кнопкой «В корзину»), схема с заделами этапов 9–11, auth-инфраструктура, Docker dev/prod. Приёмка: lint/tsc/build зелёные, seed ×2 без дублей, docker build + prod compose → 200, браузерный сценарий web-gui-tester (5/5 после фикса модалки). Спека+7 тикетов — `.scratch/stage-0/`. Следующий — этап 1 (UI корзины + чекаут)
- `.gitignore`: `!.env.example` есть; `/data` для SQLite больше не актуальна — volume БД живёт в Docker
- **AI skills (AI Hero)**: 38 навыков mattpocock/skills в `.zcode/skills/` — **единственная копия** (читает ZCode; `.agents/skills` удалён 2026-11-15 как дубль — другим агентам ставится отдельно при необходимости) + `skills-lock.json`; конфигурация — `docs/agents/` (трекер — локальные markdown-файлы в `.scratch/`, канонические лейблы триажа, single-context доки); язык домена — `GLOSSARY.md`. ZCode подхватывает навыки в новой сессии

## 4. Демо-данные (после `pnpm db:seed`)

- 5 категорий: Пицца, Шаурма, Сеты, Напитки, Десерты
- 24 товара: 8 пицц (Маргарита 590₽…), 6 шаурм (300–450₽), 3 сета («Шаурма для двоих» 690₽, «Двойная пицца» 1090₽, «Компания» 1990₽ — состав в `set_items`), 4 напитка, 3 десерта; у всех `imageUrl: null` — до этапа 5 показывается emoji-фолбэк
- 4 акции: `SHAWARMA20` −20%, `COMBO150` −150₽, `PIZZA300` −300₽, «Счастливые часы −10%» (без кода, окно дат)
- Аккаунты (вход по телефону, SMS-код всегда `1111`): **admin** `+7 999 000-00-01` · **manager** `+7 999 000-00-02` · **клиент** `+7 999 000-00-03`; email — `admin@food.local` / `manager@food.local` / `client@food.local`, оба флага верификации `true`
- Деньги — в **копейках** (int); вывод через `formatPrice()` из `@/lib/format`

## 5. Технические грабли (обязательны к соблюдению)

1. **Доки Next.js — в пакете**: `node_modules/next/dist/docs/`.
2. **next.config.ts**: `cacheComponents: true`, `partialPrefetching: true`, `reactCompiler: true` (+ dev-dep `babel-plugin-react-compiler`), `output: 'standalone'` (Docker).
3. **Cache Components**: кешируемые async-функции: `'use cache'` + `cacheLife()` + `cacheTag()`; теги: меню → `'menu'`, акции → `'promos'`, заказы → `'orders'`; профили `cacheLife` сверены с доками v16 (`hours` = stale 5м / revalidate 1ч / expire 1д). После мутаций: **`updateTag(tag)` в Server Actions** (read-your-own-writes; одиночный `revalidateTag(tag)` в v16 deprecated, в Route Handlers — `revalidateTag(tag, "max")`). Доступ к `cookies()`/`searchParams`/`new Date()` — только в некешируемых скоупах, оборачивать в `<Suspense>` (searchParams передавать вниз PROMISE'ом); исключение — `new Date()` ВНУТРИ `'use cache'` (результат кешируется, пример — год в футере). Для `new Date()`/`Math.random()` вне кеша Suspense мало — нужен `await connection()` ПЕРЕД вызовом; кешируемые запросы исполняются на пререндере сборки → `connection()` ДО них, иначе docker build требует живую БД. **Аргументы `'use cache'`-функции — часть кеш-ключа**: время внутрь не передавать. **Акции**: кешируются данные (`isActive = true`), окно `startsAt/endsAt` — фильтр на чтении вне кеша (`isPromoInWindow`, `lib/promo.ts`); **страница `/promo` целиком не кешируется** — кешируемая оболочка + список в Suspense, иначе отрендеренный список заморозится.
4. **pnpm 11**: одобрение сборок — в `pnpm-workspace.yaml` → секция `allowBuilds` (esbuild: true; better-sqlite3 больше нет — Postgres). Поле `pnpm.onlyBuiltDependencies` в package.json игнорируется.
5. **Drizzle pg-core**: `boolean()` есть; деньги — `integer` (копейки); драйвер postgres-js; `db/index.ts` без mkdir/WAL (это было для SQLite).
6. **ESLint (ESLint 9 + eslint-config-next@16)**: jsx-a11y — правилами `recommended` из явного devDep `eslint-plugin-jsx-a11y` (pnpm не поднимает транзитивные). ES9 требует плагин в том же конфиг-объекте, где правила, а повторная регистрация даёт «Cannot redefine plugin jsx-a11y» → берём УЖЕ зарегистрированный next-ом инстанс: `nextVitals.find(c => c.plugins?.["jsx-a11y"])?.plugins?.["jsx-a11y"]` — рабочий паттерн в `eslint.config.mjs`. В next-config@16 из recommended входят только 6 правил.
7. **shadcn 4.x CLI**: `pnpm dlx shadcn@latest init -y -b radix -p nova --css-variables`. Пресет nova ожидает font-переменную `--font-sans` (Geist с cyrillic-сабсетом).
8. **Темы**: next-themes (attribute=class, system); иконки переключателя — обе рендерятся, видимость через `dark:` классы (без mounted-состояния — React Compiler линт против set-state-in-effect).
9. **proxy, не middleware** — `src/proxy.ts` (гард /admin: роли admin|manager).
10. **Заказ и корзина**: id заказа = uuid (неугадываемый) → трекинг доступен гостю; корзина — серверная (`carts`/`cart_items`), гостю — httpOnly-cookie `cart_id`, при логине слияние; состав заказа берётся из корзины в БД (клиентским спискам не доверять); цены снапшотятся из БД; промокод ревалидируется на сервере; запись в `db.transaction()`.
11. **AI skills (mattpocock/skills)**: единственная копия — `.zcode/skills/` (читает ZCode); обновление — `npx skills@latest update -a zcode` (флаг обязателен: без него CLI автоопределяет агентов и пересоздаёт `.agents/skills/`); другим агентам (Copilot/Claude) — отдельная установка `npx skills add mattpocock/skills -y --copy` при необходимости. Конфигурация навыков — `docs/agents/*.md`; термины домена — только через `GLOSSARY.md`. Трекер — локальные markdown-файлы (`.scratch/<feature>/`): `gh` CLI не нужен, спеки и тикеты коммитятся вместе с этапом.
12. **Миграции**: только drizzle-kit (`generate`/`migrate`), SQL-файлы коммитятся в репозиторий; `db:push` не используем.
13. **Docker**: multi-stage Dockerfile (pnpm, standalone); дисциплина этапа — перед коммитом `docker build` проходит и `docker compose up` поднимается.
14. **ETag**: `GET /api/orders/[id]` — 304 при неизменном статусе (polling экономит тело ответа, свежесть сохраняется); `GET /api/promotions` — ETag + `Cache-Control: public, s-maxage`. Клиентский кеш страниц — Router Cache, работает сам через `cacheComponents` + `partialPrefetching`.
15. **Auth-поток (гриллинг 2026-11-15)**: better-auth phone-number plugin; вход = только телефон, вход по несуществующему телефону — ошибка «зарегистрируйтесь» (не авто-создание); SMS-OTP — фейк-код `DEMO_SMS_OTP_CODE` (по умолчанию `1111`), «отправка» = console.log + строка в `notifications`; email при регистрации обязателен, верифицируется **случайным** кодом из письма (SMTP → Mailpit в dev; без `SMTP_HOST` — код в консоль); интерактивные OTP/письма шлются напрямую, мимо аутбокса.
16. **Аутбокс**: событийные уведомления (SMS «заказ готов») — строка `notifications` **в той же транзакции**, что и событие; флушер — `setInterval`-синглтон 30 с: pending → провайдер → sent|failed. Аутбокс — только для событийных уведомлений, не для OTP.
17. **Оплата**: `PaymentProvider` (`initiate`/`verifyWebhook`) + таблица `payments` (created|processing|paid|failed|cancelled); подтверждение — `POST /api/payments/mock/webhook` с HMAC (`PAYMENTS_WEBHOOK_SECRET`); мок-страница изображает «сайт провайдера»; автоджоба статусов никогда не трогает оплаченные (отмена оплаченных = refund — вне скоупа).
18. **Env**: zod-валидация при старте (fail-fast); новые переменные: `SMTP_HOST`/`SMTP_PORT` (Mailpit), `DEMO_SMS_OTP_CODE`, `DEMO_AUTO_STATUS`, `DEMO_AUTO_STATUS_INTERVAL`, `PAYMENT_PROVIDER`, `PAYMENTS_WEBHOOK_SECRET`.
19. **MinIO — образ**: `minio/minio` удалён с Docker Hub (2025, hub возвращает 404), `bitnami/minio` — пустая оболочка без тегов → используем **`bitnamilegacy/minio:latest`** (замороженный последний MinIO, env `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, 9000 + консоль 9001; legacy-образ пишет в root-owned volume только под `user: "0:0"`). Для учебного dev-хранилища приемлемо; `minioadmin/minioadmin` в prod-компоузе — заглушка, перед реальным деплоем сменить; замена на managed S3/R2 — §9. quay.io анонимно отдаёт 401 — не вариант.
20. **Порты на этой машине (WinNAT)**: диапазоны 5256–5555 и 50000–50059 зарезервированы Hyper-V — postgres наружу идёт как **5560:5432** (и в `.env.example`). При переносе на другую машину проверить `netsh interface ipv4 show excludedportrange protocol=tcp`.
21. **better-auth id — text**: user/session/account/verification используют `text` идентификаторы → ВСЕ FK домена на user (carts.userId, orders.userId) — тоже `text`, не uuid (иначе FK «incompatible types»). Схема: `src/db/schema.ts`.

## 6. План работ

### Этап 0 — базовая кодовая база (вариант Б — пересборка с нуля, решено 2026-11-15) — ЗАВЕРШЁН 2026-11-15

- [x] create-next-app (Next 16.4, TS strict, Tailwind v4, `src/`, pnpm)
- [x] `allowBuilds` в pnpm-workspace.yaml; конфиги (next с `output: 'standalone'`/eslint/drizzle pg/`.env.example`: DATABASE_URL, S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET, AUTH_SECRET, AI-ключи, SMTP_HOST/SMTP_PORT, DEMO_SMS_OTP_CODE, DEMO_AUTO_STATUS(+_INTERVAL), PAYMENT_PROVIDER, PAYMENTS_WEBHOOK_SECRET); CLAUDE.md (→ указатель на AGENTS.md); README.md (roadmap обучения)
- [x] Docker: multi-stage Dockerfile (pnpm, standalone), `docker-compose.dev.yml` (postgres:17 + minio + mailpit: SMTP :1025, UI :8025), `docker-compose.prod.yml` (app + postgres + minio)
- [x] shadcn init (radix/nova) + компоненты: button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch
- [x] Схема Drizzle pg-core: `ORDER_STATUSES` — 8 статусов (`created|preparing|ready|in_delivery|delivered|picked_up|cancelled_by_customer|cancelled_by_vendor`), `orders.paymentStatus` pending|paid — под этап 9; таблицы `payments`, `notifications` (аутбокс), `error_events` — сразу, под этапы 9–11; user — phone уникальный + email обязательный + флаги верификации; `db/index.ts` (postgres-js) + миграции drizzle-kit (SQL в git) + идемпотентный сидер (admin/manager/client — телефон/email, оба верифицированы)
- [x] better-auth: `lib/auth.ts` (phone-number plugin, роли admin/manager/customer, cookieCache 5 мин, `sendOTP` — фейк `1111` + строка в `notifications`), `auth-client.ts`, `session.ts` (getSession/getAdminSession), `/api/auth/[...all]`
- [x] `lib/format.ts` (formatPrice, formatDate, formatDateTime, STATUS_LABELS); queries: `getFullMenu`/`getProduct` (тег `menu`), `getActivePromotions` (кеш данных + окно на чтении, тег `promos`), orders без кеша; actions: корзина — add/setQty/remove (гостевая httpOnly cookie `cart_id`), `createOrder`, `applyPromoCode`
- [x] Каркас магазина: layout (lang=ru, skip-link, ThemeProvider, Toaster, Geist latin+cyrillic), header/footer, product-card/details, promo-card; маршруты `/` (**меню на главной**: sticky-навигация по категориям — якорный скролл `#pizza`… + scrollspy, поиск `?q`), `/product/[id]` (fallback), `@modal` (перехват с главной → модалка)
- [x] Проверка: lint чист, `db:seed` идемпотентен, `GET /` → 200, `docker build` проходит, `docker compose up` поднимается; точные значения профилей `cacheLife` сверены с `node_modules/next/dist/docs/`
- [x] Коммит «Этап 0»

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

### Этап 3 — Auth (телефон + email) + история заказов

- [ ] Вкладки `(auth)/register` (email + phone, оба обязательные) и `(auth)/login` (только phone), формы с aria-ошибками; вход по несуществующему телефону — ошибка «зарегистрируйтесь»
- [ ] Регистрация: SMS-OTP на телефон — фейк-код `1111`, UI «SMS отправлено» (строка в `notifications`) → аккаунт создан, `phoneVerified`
- [ ] Верификация email: письмо со **случайным** кодом → SMTP → Mailpit (:8025), код вводится в форму → `emailVerified`; без `SMTP_HOST` — код в консоль
- [ ] Слияние гостевой корзины с пользовательской при входе
- [ ] `(shop)/orders/page.tsx` — **закрытая зона пользователя**: текущий заказ + история (гард по сессии; раскладка — при описании layout)
- **Готово, когда**: регистрация нового клиента проходит через OTP + код из Mailpit, вход демо-аккаунтами по телефону, история видна только владельцу, гостевая корзина доехала до аккаунта

### Этап 4 — Трекинг заказа

- [ ] `(shop)/orders/[id]/page.tsx` (доступ: владелец по сессии или uuid-ссылка): таймлайн статусов (иконка+текст, не только цвет)
- [ ] `GET /api/orders/[id]` + ETag (304 при неизменном статусе) + polling ~5 с; `loading.tsx`, `not-found.tsx`, `error.tsx`
- **Готово, когда**: гость по uuid-ссылке видит статус, обновляющийся без перезагрузки

### Этап 5 — Админка + картинки

- [ ] `lib/actions/products.ts` + `promotions.ts` + `updateOrderStatus` (requireAdmin через getAdminSession, revalidateTag)
- [ ] Картинки: S3-клиент через env (`S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET`), upload — FormData → sharp → PutObject; `next/image` + `remotePatterns` на endpoint; emoji — фолбэк при пустом `imageUrl`
- [ ] `/admin` — редирект на `/admin/orders` (дашборд — опция при layout), `/admin/orders` — все заказы (фильтры по статусу, useOptimistic + смена статуса, `paymentStatus`), `/admin/products` (CRUD single+set, редактор состава, upload фото), `/admin/promotions`, `/admin/users` (список: имя/телефон/email/роль/регистрация/заказы; admin — смена роли)
- [ ] `src/proxy.ts` — гард /admin: роли admin|manager (matcher); права manager внутри — при описании layout
- **Готово, когда**: гость на `/admin` → редирект; admin и manager входят; CRUD сета с составом работает; фото загружается и показывается на карточке; смена статуса мгновенно видна на трекинге

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

### Этап 9 — Оплата (мок-провайдер с webhook-контрактом)

- [ ] `lib/payments/`: интерфейс `PaymentProvider` (`initiate`/`verifyWebhook`), реализация `MockProvider`, выбор по env `PAYMENT_PROVIDER`
- [ ] Таблица `payments` (создана на этапе 0): записи created|processing|paid|failed|cancelled, amount в копейках, provider, external_id, timestamps
- [ ] Мок-страница — «сайт провайдера» `(shop)/orders/[id]/pay/page.tsx` (доступ — владелец по сессии или uuid): логотип-заглушка, форма «карта», кнопка «Оплатить» → `POST /api/payments/mock/webhook` (HMAC `PAYMENTS_WEBHOOK_SECRET`) → `payments: paid` → `orders.paymentStatus: paid` → `revalidateTag('orders')` → редирект на трекинг (как return_url)
- [ ] Чекаут: выбор «карта (мок-провайдер) / при получении»; «при получении» — заказ сразу подтверждён; замена на реального провайдера = новый файл + env, без правки UI и схемы
- **Готово, когда**: «заказ с картой → мок-провайдер → webhook → на трекинге „оплацен“»; при получении — заказ сразу подтверждён

### Этап 10 — Уведомления (аутбокс) + автоджоба статусов

- [ ] `lib/notifications/`: `SmsProvider` (консоль) и `EmailProvider` (nodemailer SMTP → Mailpit; без `SMTP_HOST` — консоль); флушер — `setInterval`-синглтон 30 с: pending → send → sent|failed
- [ ] SMS «заказ готов»: строка в `notifications` в транзакции `updateOrderStatus` при переходе в `ready`; текст ветвится по fulfillment (доставка/самовывоз)
- [ ] Автоджоба `lib/jobs/auto-status.ts` (env `DEMO_AUTO_STATUS`: dev on, prod off): шаг 60 с (`DEMO_AUTO_STATUS_INTERVAL`) по цепочке до терминального, ветка по fulfillment; ~10% отмен на `created`/`preparing` — `cancelled_by_vendor`, только неоплаченные; никогда не отменяет оплаченные и не оплачивает
- **Готово, когда**: переход в `ready` рождает SMS (консоль + строка в `notifications`); заказ «оживает» без админки; оплаченные не отменяются

### Этап 11 — Ops-харднинг

- [ ] `GET /api/health`: `SELECT 1` + headBucket(MinIO) → 200|503; `HEALTHCHECK` в Dockerfile
- [ ] pino + request-id — структурные логи в stdout; error/warn → `error_events` (задел под Sentry)
- [ ] Security-заголовки через `headers()` в next.config (X-Content-Type-Options, X-Frame-Options, Referrer-Policy; без строгого CSP)
- [ ] zod-валидация env при старте (fail-fast)
- [ ] Entrypoint: drizzle-migrate перед стартом сервера; `scripts/backup-db.sh` (pg_dump) + документация
- **Готово, когда**: прод-компоуз — health зелёный, логи структурные, env с опечаткой роняет контейнер на старте

## 7. A11y-чек-лист (на каждый модуль)

- Landmarks, один h1, skip-link (в layout)
- Клавиатурность + focus-visible; фокус-ловушка модалок (Dialog)
- label + aria-invalid + aria-describedby
- Статус — не только цветом; emoji — `aria-hidden`
- Динамика через aria-live; prefers-reduced-motion
- Только CSS-токены (`bg-background`/`text-foreground` и т.п.)
- Контраст ≥ 4.5:1 в обеих темах

## 8. Функциональная спецификация (кратко)

- **Happy path клиента**: главная `/` — **меню на ней** (секции: «Акции недели» в Suspense; sticky-навигация по категориям — якорный скролл + scrollspy, поиск `?q` через searchParams; «Популярное» — §9) → модалка товара (intercepting, открывается по ссылке `/product/[id]` с главной) → корзина (серверная: `carts`/`cart_items`; гостю — httpOnly cookie `cart_id`, при логине слияние) → промокод (поле на корзине) → чекаут (контакты + способ оплаты) → заказ (uuid) → трекинг `создан → готовится → готов → (в доставке → доставлен | выдан)` (+ `отменён клиентом` / `отменён заведением — не принят`), при `готов` — SMS через аутбокс, polling ~5 с (ETag → 304). Auth: вход по телефону (SMS-OTP фейк `1111`), регистрация — email + phone, email верифицируется случайным кодом из письма (Mailpit). Закрытые страницы: `/admin/*` — admin+manager; `/orders`, `/orders/[id]` (+ pay) — владелец по сессии, гостю — uuid-ссылка
- **API**: Route Handlers — ровно 6: `GET /api/orders/[id]`, `GET /api/promotions`, `POST /api/chat`, `/api/auth/[...all]` (send-phone-otp, sign-in phone, sign-up phone+email, verify-email, sign-out, get-session), `POST /api/payments/mock/webhook` (этап 9, HMAC), `GET /api/health` (этап 11). Server Actions — корзина (add/setQty/remove), `createOrder`, `applyPromoCode`, `updateOrderStatus`, `updateUserRole` (admin), CRUD products (вкл. set_items)/categories/promotions; оплата — через webhook-роут (не action); событийные уведомления — аутбокс + флушер; автоджоба — модуль, не action. Каталог/акции/заказы читаются в RSC из БД напрямую, без HTTP.
- **Каталог**: `type single|set`, состав сетов в `set_items`, выгода — зачёркнутая старая цена, фото из MinIO (`imageUrl`) или emoji-фолбэк

## 9. Roadmap после MVP

Рассылка акций (email-кампании через аутбокс + верстка писем — задел готов: email у пользователя, Mailpit в dev), настоящий SMS-провайдер (замена консольной заглушки), PWA-пуши (Web Push), настоящий платёжный провайдер (замена `MockProvider` — новый файл + env), возвраты/refund (нужны для отмены оплаченных заказов), роли персонала (кухня/курьер, KDS), модификаторы (размер/тесто) и слоты/зоны доставки, повтор заказа, лояльность, TLS/домен (Caddy), Sentry (задел — `error_events`), автоматические бэкапы по расписанию (pg_dump-скрипт — этап 11), rate limiting, e2e-тесты (vitest + Playwright), managed Postgres при serverless-переезде, managed S3/R2 вместо MinIO.

## 10. Правила ведения этого файла

1. После завершения этапа: отметить чекбоксы `[x]`, обновить раздел 3 «Текущее состояние», закоммитить.
2. Новые решения и грабли дописывать в раздел 5, не удаляя старые.
3. Этот файл — источник правды; чат и память агента — только указатели на него.

## 11. Приложение — состав базовой кодовой базы (детальная спецификация, вариант Б)

**Корень:** next.config.ts (cacheComponents, partialPrefetching, reactCompiler, `output: 'standalone'`), eslint.config.mjs, drizzle.config.ts (dialect postgres), pnpm-workspace.yaml (allowBuilds: esbuild), .env.example (DATABASE_URL, S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET, AUTH_SECRET, AI-ключи, SMTP_HOST/SMTP_PORT, DEMO_SMS_OTP_CODE, DEMO_AUTO_STATUS, DEMO_AUTO_STATUS_INTERVAL, PAYMENT_PROVIDER, PAYMENTS_WEBHOOK_SECRET), Dockerfile (multi-stage, pnpm, standalone, HEALTHCHECK — этап 11), docker-compose.dev.yml (postgres:17 + minio + mailpit), docker-compose.prod.yml (app + postgres + minio), CLAUDE.md (→ указатель на AGENTS.md), README.md (roadmap обучения).

**`src/app/layout.tsx`:** lang="ru", skip-to-content, ThemeProvider, Toaster, Geist (latin+cyrillic, переменная `--font-sans`).

**Auth:** `api/auth/[...all]/route.ts` — better-auth handler (toNextJsHandler); `lib/auth.ts` (betterAuth + drizzleAdapter + phoneNumber plugin, роли admin/manager/customer — additionalField с `input: false`, cookieCache 5 мин; `sendOTP` — фейк-код `DEMO_SMS_OTP_CODE` → консоль + строка в `notifications`; email-верификация — случайный код через SMTP/Mailpit); `lib/auth-client.ts`; `lib/session.ts` (getSession, getAdminSession); `lib/format.ts` (formatPrice, formatDate, formatDateTime, STATUS_LABELS — 8 статусов). Гостевая корзина — httpOnly-cookie `cart_id` (uuid); при логине — слияние в пользовательскую.

**БД (pg-core):** `db/schema.ts` — user/session/account/verification + categories, products (type single|set, emoji, `imageUrl` nullable, price в копейках int), set_items, promotions (discountType percent|fixed, code nullable, startsAt/endsAt, isActive), carts (uuid, user_id nullable, promo_id nullable, timestamps), cart_items (cart_id, product_id, qty, уникальность пары), orders (uuid, status — одно из `ORDER_STATUSES` (8 значений: цепочка с веткой по fulfillment и двумя терминальными отменами), fulfillment, promoId, discountAmount, paymentStatus pending|paid — под этап 9), order_items (снапшот), payments (order_id, amount копейки, status created|processing|paid|failed|cancelled, provider, external_id, timestamps), notifications (channel email|sms, event, payload jsonb, status pending|sent|failed, error, timestamps — аутбокс), error_events (level error|warn, message, stack, context jsonb, timestamps); типы + `ORDER_STATUSES`. `db/index.ts` — postgres-js. Миграции — drizzle-kit, SQL-файлы в git. `db/seed.ts` — идемпотентный (аккаунты с телефонами/email, верифицированные).

**Запросы:** `queries/menu.ts` — `getFullMenu()` (`'use cache'` + `cacheLife('hours')` + тег `'menu'`): категории+товары+составы сетов, тип `MenuProduct` c setComponents/setOldPrice; `getProduct(id)`. `queries/promotions.ts` — `getCachedActivePromotions()` (`'use cache'` + `cacheLife('hours')` + тег `'promos'`, фильтр isActive — данные без времени) + обёртка `getActivePromotions()` без кеша: `new Date()` + фильтр окна startsAt/endsAt на каждом чтении. `queries/cart.ts` — `getCart(cartId)` — динамика, без `'use cache'` (персональные данные). `queries/orders.ts` — без кеша: `getOrderById`, `getUserOrders`, `getAllOrders`. `queries/users.ts` — `getUsers` (админ-список, без кеша).

**Действия:** `actions/cart.ts` (`'use server'`): addToCart/setQty/removeFromCart — cookie гостя либо корзина пользователя, пересчёт инвалидирует через revalidate текущего маршрута. `actions/orders.ts` (`'use server'`): `createOrder(payload)` — только контакты; состав из корзины в БД, снапшот цен из БД, ревалидация промокода, транзакция, `revalidateTag('orders')`, результат `{ ok, data: { orderId } }`; `applyPromoCode(code)` — валидация, promo_id на корзину; `payMockOrder(orderId)` (этап 9) — доступ как у трекинга (сессия владельца или uuid); `updateUserRole(userId, role)` — только admin. Тип `ActionResult<T>`. Корзина очищается после оформления заказа. **Фон (этапы 10–11):** `lib/notifications/` — `SmsProvider` (консоль) / `EmailProvider` (nodemailer → Mailpit, без `SMTP_HOST` — консоль) + флушер (setInterval-синглтон 30 с); `lib/jobs/auto-status.ts` — автоджоба (`DEMO_AUTO_STATUS`); `lib/payments/` — `PaymentProvider` + `MockProvider` (выбор по env); `lib/logger.ts` — pino + request-id, error/warn → `error_events`; `lib/env.ts` — zod-валидация env при старте.

**Компоненты:** theme-provider, theme-toggle; `shop/`: header (клиентский: навигация Меню/Акции/Ассистент, ThemeToggle, AuthArea на useSession, CartButton — бейдж как динамический фрагмент в Suspense), footer, add-to-cart-button (server action + useOptimistic + toast), product-card (серверный: бейдж выгоды, зачёркнутая старая цена, `<Image>` по imageUrl или emoji-фолбэк), product-details (клиентский: режим модалки asDialog через router.back() + режим страницы, степпер количества), promo-card (+formatDiscount).

**Маршруты:** `(shop)/layout.tsx` (рендерит `{children}` + `{modal}`); `(shop)/page.tsx` — **главная = меню** (searchParams `?q` в Suspense; нативная GET-форма поиска; sticky-пилюли категорий — якорные ссылки `#pizza`…, клиентский scrollspy на IntersectionObserver, секции с `scroll-margin-top`; группировка по категориям; секции над меню (решено гриллингом 2026-11-15): «Акции недели» в Suspense (getActivePromotions, ссылка «все →» на /promo); hero удалён по решению пользователя (2026-11-15); «Популярное» — отложено до появления заказов (§9)); `(shop)/@modal/default.tsx`; `(shop)/@modal/(.)product/[id]/page.tsx` (intercepting → модалка товара, открывается по ссылке `/product/[id]` с главной); `(shop)/product/[id]/page.tsx` (fallback + generateMetadata); закрытая зона пользователя: `(shop)/orders/page.tsx` (текущий заказ + история, гард по сессии), `(shop)/orders/[id]/page.tsx` (трекинг; владелец по сессии или uuid), `(shop)/orders/[id]/pay/page.tsx` — мок-оплата, «сайт провайдера» (этап 9, тот же доступ); админ-зона: `/admin` (редирект на `/admin/orders`), `/admin/orders` (все заказы, смена статуса; admin+manager), `/admin/products` (CRUD single+set, редактор состава, upload), `/admin/promotions`, `/admin/users` (пользователи + смена роли — admin; права manager — при описании layout). Auth-зона: `(auth)/register` (email + phone) и `(auth)/login` (phone) — этап 3. Route Handlers: `/api/orders/[id]` (ETag), `/api/promotions` (ETag), `/api/chat`, `/api/auth/[...all]`, `/api/payments/mock/webhook` (этап 9), `/api/health` (этап 11).

**Компоненты shadcn:** button card input label textarea select badge dialog sheet separator sonner skeleton dropdown-menu table tabs switch.

## Agent skills

### Issue tracker

Issues — локальные markdown-файлы в `.scratch/<feature-slug>/`: спека — `spec.md`, тикеты — `issues/NN-<slug>.md` с `Status:` и `Blocked by:` строками. См. `docs/agents/issue-tracker.md`.

### Triage labels

Канонические лейблы без переименований: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` в корне + ADR в `docs/adr/` (создаются лениво). См. `docs/agents/domain.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
