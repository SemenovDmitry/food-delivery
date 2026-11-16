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

Next.js 16.4.6 (App Router, Turbopack, Cache Components, Partial Prefetching, React Compiler) · React 19.3 · TypeScript strict · Tailwind v4 + shadcn/ui (radix, preset nova) · **PostgreSQL 17 в docker-compose + Drizzle ORM (pg-core, драйвер postgres-js, миграции drizzle-kit)** · better-auth (phone-number plugin: регистрация/вход по телефону с SMS-OTP, email-верификация кодом из письма; роли admin/manager/customer) · **MinIO (S3-совместимое хранилище; клиент @aws-sdk/client-s3) + sharp (обработка фото)** · **WebSockets — `ws`: отдельный шлюз `ws-gateway` (workspace-пакет, второй процесс в docker-compose) + Postgres LISTEN/NOTIFY (фанаут сообщений чата)** · next-themes · nodemailer (SMTP → Mailpit) · pino (структурные логи) · zod (валидация env) · **react-hook-form + zod** (формы: правила в `lib/schemas/`, тип формы = `z.infer`, клиент — zodResolver, серверная часть парсит ту же схему в safeParse — CheckoutForm переписана 2026-11-15, админ-формы этапа 5 — так же) · пакетный менеджер **pnpm 11** (pnpm-workspace.yaml с `allowBuilds`; npm/yarn не используем).

Решения гриллинга 2026-11-15 (полная картина — §6, §8, §11): **без отдельного бэкенда** — монолит Next.js: чтения RSC напрямую из БД, записи Server Actions, Route Handlers ровно 6 (+ payment-webhook, + health); **Postgres вместо SQLite** с этапа 0; **серверная корзина вместо Zustand**; **максимальное кеширование** (§5.3, §6, §11); **production-ready-заглушки** (вторая сессия гриллинга 2026-11-15): auth по телефону + верифицируемый email, 8 статусов, PaymentProvider + payments + webhook, аутбокс `notifications` + SMS «заказ готов», автоджоба статусов, ops-харднинг — этапы 9–11 в §6, грабли §5.15–18, детали §11.

## 3. Текущее состояние (срез после этапа 3, 2026-11-16; исторический нарратив — история git)

- GitHub: `origin → https://github.com/SemenovDmitry/food-delivery`; все коммиты локальные — пуш только по явной просьбе
- **Завершены этапы 0–3** (спеки+тикеты — `.scratch/stage-{0,1,2,3}/`, скриншоты приёмок — `.scratch/stage-*/screenshots/`):
  - **0** — каркас магазина: меню на главной («Акции недели» + sticky-навигация + поиск `?q` в шапке), модалка товара на клиентском состоянии с `?product=<id>` (intercepting сломан — §5.22), серверная корзина, схема с заделами этапов 9–11, auth-инфраструктура (better-auth, телефон), Docker dev/prod
  - **1** — корзина/чекаут (гриллинг 4 раунда): скоуп-скидки + `minTotal` + таблица `settings`, доставка 199 ₽/бесплатно от 1 000 ₽ (от суммы до скидки), поток `/cart` (редактирование) → `/checkout` (подтверждение), квитанция `/orders/[id]` с uuid-ссылкой, бейдж Σqty в Suspense-слоте, CheckoutForm = RHF+zod (`lib/schemas/`)
  - **2** — акции: `/promo` (оболочка + Suspense-сетка), `GET /api/promotions` (кураторский DTO + ручной ETag/304 + `s-maxage=60`), миграция `promotions.isPublic` — **публичные акции vs скрытые промокоды** (GLOSSARY): витринный кеш фильтрует `isActive + isPublic` в WHERE (скрытые — только ввод кода на /cart), сидер `SECRET15` −15% (скрытый)
  - **3** — auth (гриллинг Q1–Q5: **регистрация только телефон**, email — отдельный поток, отмена «email обязателен в форме»): `/login` + `/register` — визарды-близнеца «телефон → SMS 1111» с гардами («зарегистрируйтесь» / «войдите», SMS не уходит), аккаунт создаёт verify (temp-email), `(auth)/email` — возобновляемая привязка email (уникальность с явной ошибкой → случайный код из Mailpit → `emailVerified`; CTA — меню профиля + баннер /orders), `mergeGuestCartOnAuth` — слияние корзин при входе (усиновление или транзакция с капом; промо юзера иначе гостя), `/orders` — закрытая зона (текущий + история, гард по сессии), шапка — иконка «Профиль» → dropdown (без имени), нормализация телефона `lib/phone.ts` (`8…`→`+7 XXX XXX-XX-XX`)
- Роутинг и роли: **меню — на главной `/`**; модалка товара по ссылке `/product/[id]` с главной; роли **admin/manager/customer**; закрытые зоны: `/admin/*` — admin+manager (внутри: `/admin/orders` — оба, `/admin/products|promotions|users` — admin), `/orders` и `/orders/[id]` — владелец по сессии (uuid-ссылка для гостя), `/email` — по сессии; `/promo` — публичная
- **Этап 6 — real-time чат поддержки на WebSockets** (AI-ассистент исключён, §5.23): плавающий виджет на любой странице, операторская `/admin/chats` (табы: телефон или «unknown»); поиск — GET-форма в шапке
- Следующий — **этап 4** (трекинг заказа: таймлайн статусов, ETag-polling)
- `.gitignore`: `!.env.example` есть; volume БД живёт в Docker
- **AI skills (AI Hero)**: 38 навыков mattpocock/skills в `.zcode/skills/` — **единственная копия** (`.agents/skills` удалён как дубль; другим агентам ставится отдельно) + `skills-lock.json`; конфигурация — `docs/agents/` (трекер — локальные markdown в `.scratch/`, лейблы триажа, single-context доки); язык домена — `GLOSSARY.md`; ZCode подхватывает навыки в новой сессии

## 4. Демо-данные (после `pnpm db:seed`)

- 5 категорий: Пицца, Шаурма, Сеты, Напитки, Десерты
- 24 товара: 8 пицц (Маргарита 590₽…), 6 шаурм (300–450₽), 3 сета («Шаурма для двоих» 690₽, «Двойная пицца» 1090₽, «Компания» 1990₽ — состав в `set_items`), 4 напитка, 3 десерта; у всех `imageUrl: null` — до этапа 5 показывается emoji-фолбэк
- Акции: 3 публичные — `SHAWARMA20` −20% (шаурма), `COMBO150` −150₽ (сеты), `PIZZA300` −300₽ (пицца, при заказе от 1000 ₽) + **скрытый промокод** `SECRET15` −15% на весь заказ (этап 2: нигде не показывается, применяется только вводом кода — демонстрация инпута)
- Аккаунты (вход по телефону, SMS-код всегда `1111`): **admin** `+7 999 000-00-01` · **manager** `+7 999 000-00-02` · **клиент** `+7 999 000-00-03`; email — `admin@food.local` / `manager@food.local` / `client@food.local`, оба флага верификации `true`
- Деньги — в **копейках** (int); вывод через `formatPrice()` из `@/lib/format`

## 5. Технические грабли (обязательны к соблюдению)

1. **Доки Next.js — в пакете**: `node_modules/next/dist/docs/`.
2. **next.config.ts**: `cacheComponents: true`, `partialPrefetching: true`, `reactCompiler: true` (+ dev-dep `babel-plugin-react-compiler`), `output: 'standalone'` (Docker).
3. **Cache Components**: кешируемые async-функции: `'use cache'` + `cacheLife()` + `cacheTag()`; теги: меню → `'menu'`, акции → `'promos'`, заказы → `'orders'`; профили `cacheLife` сверены с доками v16 (`hours` = stale 5м / revalidate 1ч / expire 1д). После мутаций: **`updateTag(tag)` в Server Actions** (read-your-own-writes; одиночный `revalidateTag(tag)` в v16 deprecated, в Route Handlers — `revalidateTag(tag, "max")`). Доступ к `cookies()`/`searchParams`/`new Date()` — только в некешируемых скоупах, оборачивать в `<Suspense>` (searchParams передавать вниз PROMISE'ом); исключение — `new Date()` ВНУТРИ `'use cache'` (результат кешируется, пример — год в футере); для **Route Handlers** `connection()` не нужен — чтение `request` уже делает роут динамическим (v15+ GET динамические по умолчанию). Для `new Date()`/`Math.random()` вне кеша Suspense мало — нужен `await connection()` ПЕРЕД вызовом; кешируемые запросы исполняются на пререндере сборки → `connection()` ДО них, иначе docker build требует живую БД. **Аргументы `'use cache'`-функции — часть кеш-ключа**: время внутрь не передавать. **Акции**: кешируются данные (`isActive = true`), окно `startsAt/endsAt` — фильтр на чтении вне кеша (`isPromoInWindow`, `lib/promo.ts`); **страница `/promo` целиком не кешируется** — кешируемая оболочка + список в Suspense, иначе отрендеренный список заморозится.
4. **pnpm 11**: одобрение сборок — в `pnpm-workspace.yaml` → секция `allowBuilds` (esbuild: true; better-sqlite3 больше нет — Postgres). Поле `pnpm.onlyBuiltDependencies` в package.json игнорируется.
5. **Drizzle pg-core**: `boolean()` есть; деньги — `integer` (копейки); драйвер postgres-js; `db/index.ts` без mkdir/WAL (это было для SQLite).
6. **Линтер/форматтер — Biome 2.6** (2026-11-15 заменил ESLint; ESLint-пакеты и `eslint.config.mjs` сняты): `pnpm lint` = `biome lint .`, `pnpm format` = `biome format --write .`, `pnpm check` = `biome check --write .` (lint + format + organizeImports). Конфиг `biome.json`: preset `recommended` (не `linter.rules.recommended` — deprecated в 2.6), CSS-парсер `tailwindDirectives: true` (иначе `@theme`/`@custom-variant` Tailwind v4 не парсятся), `files.includes` — список с `**` ПЕРВЫМ и `!`-негациями (только негативные паттерны = пустой охват); excludes: `.zcode`, `.agents`, `skills-lock.json`, `drizzle/meta`. a11y-правила у Biome меньше jsx-a11y — a11y-чек-лист §7 обязателен и без линтера. Next-специфичных правил (например no-img-element) в Biome нет — следить за `next/image` руками.
7. **shadcn 4.x CLI**: `pnpm dlx shadcn@latest init -y -b radix -p nova --css-variables`. Пресет nova ожидает font-переменную `--font-sans` (Geist с cyrillic-сабсетом).
8. **Темы**: next-themes (attribute=class, system); иконки переключателя — обе рендерятся, видимость через `dark:` классы (без mounted-состояния — React Compiler линт против set-state-in-effect).
9. **proxy, не middleware** — `src/proxy.ts` (гард /admin: роли admin|manager).
10. **Заказ и корзина**: id заказа = uuid (неугадываемый) → трекинг доступен гостю; корзина — серверная (`carts`/`cart_items`), гостю — httpOnly-cookie `cart_id`, при логине слияние; состав заказа берётся из корзины в БД (клиентским спискам не доверять); цены снапшотятся из БД; промокод ревалидируется на сервере; запись в `db.transaction()`.
11. **AI skills (mattpocock/skills)**: единственная копия — `.zcode/skills/` (читает ZCode); обновление — `npx skills@latest update -a zcode` (флаг обязателен: без него CLI автоопределяет агентов и пересоздаёт `.agents/skills/`); другим агентам (Copilot/Claude) — отдельная установка `npx skills add mattpocock/skills -y --copy` при необходимости. Конфигурация навыков — `docs/agents/*.md`; термины домена — только через `GLOSSARY.md`. Трекер — локальные markdown-файлы (`.scratch/<feature>/`): `gh` CLI не нужен, спеки и тикеты коммитятся вместе с этапом.
12. **Миграции**: только drizzle-kit (`generate`/`migrate`), SQL-файлы коммитятся в репозиторий; `db:push` не используем.
13. **Docker**: multi-stage Dockerfile (pnpm, standalone); дисциплина этапа — перед коммитом `docker build` проходит и `docker compose up` поднимается.
14. **ETag**: `GET /api/orders/[id]` — 304 при неизменном статусе (polling экономит тело ответа, свежесть сохраняется); `GET /api/promotions` — ETag + `Cache-Control: public, s-maxage`. Клиентский кеш страниц — Router Cache, работает сам через `cacheComponents` + `partialPrefetching`.
15. **Auth-поток (гриллинг 2026-11-15; пересмотрен гриллингом этапа 3, 2026-11-16)**: better-auth phone-number plugin; вход = только телефон, вход по несуществующему телефону — ошибка «зарегистрируйтесь» (не авто-создание); SMS-OTP — фейк-код `DEMO_SMS_OTP_CODE` (по умолчанию `1111`), «отправка» = console.log + строка в `notifications`; интерактивные OTP/письма шлются напрямую, мимо аутбокса. **Механика плагина (проверено по исходникам node_modules, этап 3)**: пользователь создаётся ТОЛЬКО в момент ввода кода (`verifyPhoneNumber` + `signUpOnVerification`) и всегда с temp-email (`getTempEmail` перетирает email И name из body) — настоящий email привязывает отдельный поток `/email` (Q1/Q5 этапа 3: `linkEmail` — уникальность явной ошибкой, потом `sendVerificationOTP` — для несуществующего email он молчит, анти-энумерация); `sendOTP` не проверяет существование номера — гарды «зарегистрирован/свободен» в наших actions ДО вызова; `signInPhoneNumber` парольный — не используем, вход = send-otp + verify; телефон — точное совпадение строк (нормализация `lib/phone.ts` → канон сидера `+7 XXX XXX-XX-XX`); rate limits prod: `/phone-number/*` 10/мин, email-OTP 3/мин — не трогаем.
16. **Аутбокс**: событийные уведомления (SMS «заказ готов») — строка `notifications` **в той же транзакции**, что и событие; флушер — `setInterval`-синглтон 30 с: pending → провайдер → sent|failed. Аутбокс — только для событийных уведомлений, не для OTP.
17. **Оплата**: `PaymentProvider` (`initiate`/`verifyWebhook`) + таблица `payments` (created|processing|paid|failed|cancelled); подтверждение — `POST /api/payments/mock/webhook` с HMAC (`PAYMENTS_WEBHOOK_SECRET`); мок-страница изображает «сайт провайдера»; автоджоба статусов никогда не трогает оплаченные (отмена оплаченных = refund — вне скоупа).
18. **Env**: zod-валидация при старте (fail-fast); новые переменные: `SMTP_HOST`/`SMTP_PORT` (Mailpit), `DEMO_SMS_OTP_CODE`, `DEMO_AUTO_STATUS`, `DEMO_AUTO_STATUS_INTERVAL`, `PAYMENT_PROVIDER`, `PAYMENTS_WEBHOOK_SECRET`.
19. **MinIO — образ**: `minio/minio` удалён с Docker Hub (2025, hub возвращает 404), `bitnami/minio` — пустая оболочка без тегов → используем **`bitnamilegacy/minio:latest`** (замороженный последний MinIO, env `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, 9000 + консоль 9001; legacy-образ пишет в root-owned volume только под `user: "0:0"`). Для учебного dev-хранилища приемлемо; `minioadmin/minioadmin` в prod-компоузе — заглушка, перед реальным деплоем сменить; замена на managed S3/R2 — §9. quay.io анонимно отдаёт 401 — не вариант.
20. **Порты на этой машине (WinNAT)**: диапазоны 5256–5555 и 50000–50059 зарезервированы Hyper-V — postgres наружу идёт как **5560:5432** (и в `.env.example`). При переносе на другую машину проверить `netsh interface ipv4 show excludedportrange protocol=tcp`.
21. **better-auth id — text**: user/session/account/verification используют `text` идентификаторы → ВСЕ FK домена на user (carts.userId, orders.userId) — тоже `text`, не uuid (иначе FK «incompatible types»). Схема: `src/db/schema.ts`.
22. **Intercepting routes НЕ используем (Next 16.4.6 + cacheComponents)**: повторный софт-нав на тот же перехваченный URL после закрытия модалки ломает слоты — URL меняется, рендер не коммитится (пустой main; воспроизводится и в prod-сборке; независимо от back()/replace()/controlled-open). Модалка товара — клиентское состояние в ProductCard, синхронизированное с query-параметром `?product=<id>` через pushState/replaceState (hash-вариант ломал якорную навигацию #sets, push/back пути — hang; query на том же пути — лёгкий shallow-синк без серверных запросов). Ссылка-шаринг `/?product=<id>` открывает каталог сразу с модалкой; прямой заход — fallback-страница; `@modal`/`(.)product` удалены. Вернуть intercepting при исправлении Next.
23. **WebSockets (решение 2026-11-15, этап 6)**: в Route Handlers WS не работают (доки Next, `backend-for-frontend.md` — соединение закрывается по таймауту); кастомный сервер отпадает — ломает `output: 'standalone'` (п. 2) и Docker-дисциплину (п. 13). Решение — **отдельный WS-шлюз** `ws-gateway/` (workspace-пакет, Node + `ws`, порт 3001): шлюз — только транспорт, персист и бизнес-логика остаются в Next; auth при upgrade — cookies пересылаются в `/api/auth/get-session` (куки не изолируются по порту — localhost:3000 и :3001 делят их); записи клиента — через служебный `POST /api/chat/internal` (`x-internal-secret`) с INSERT + NOTIFY в транзакции; фанаут — Postgres LISTEN/NOTIFY; URL шлюза клиенту — `NEXT_PUBLIC_WS_URL`.
24. **Валидный UUID до запроса в БД** (`isUuid` в `lib/id.ts`, ревью этапа 1 — правило было в коде, но не в документе): Postgres падает «invalid input syntax for type uuid» на кривом/обрезанном uuid в where — гард стоит в `getProduct` (→ not-found), cart-actions (→ «Товара нет в корзине») и потребителях `getOrderById` (квитанция → not-found). Новые запросы по uuid-колонкам с внешним id — тот же гард ДО запроса.
25. **Браузерная приёмка — рецепт в `docs/agents/browser-testing.md`** (ретро этапа 1: переоткрытие квирок съело ~половину браузерного бюджета): IAB-квирки — locator.click vs actionability из-за `scroll-behavior: smooth`, evaluate читает устаревший документ после мягких навигаций, скролл только `behavior: 'instant'`, cua.scroll дробить по ~300. Читать ДО первой приёмки в сессии.
26. **docker-compose: dev и prod — одно имя проекта и общие volumes** (`food-postgres-data`, `food-minio-data`): `docker compose -f docker-compose.prod.yml up -d` подменяет контейнеры dev-стека (postgres :5560 исчезает → «Failed query» в dev-сервере). Возврат — `docker compose -f docker-compose.dev.yml up -d`; данные целы (общий volume). Prod-подъём всегда заканчивать возвратом dev.
27. **Локальный pre-commit** (`scripts/hooks/pre-commit`: biome check + tsc --noEmit, ретро этапа 1; husky не используется): включается после клона одной командой — `git config core.hooksPath scripts/hooks`. Без хука формат/lint/типы доезжают до ревью.
28. **docker compose `up -d` без `--build` поднимает СТАРЫЙ образ** (приёмка этапа 2): compose переиспользует существующий image — новый маршрут отдаёт HTML-404. После правок кода — `docker compose -f docker-compose.prod.yml up -d --build`. Смежное — §5.26 (prod-стек не публикует :5560: хостовый `pnpm db:seed` падает ECONNREFUSED, пока поднят prod).
29. **Прямой SQL мимо actions не инвалидирует кеш-теги** (`'promos'`, `'orders'`): `'use cache'` хранит снимок строк — правка флагов/окон в БД невидима чтениям до `updateTag`/рестарта (урок теста C1 этапа 1 + приёмка этапа 2). Проверка кеш-свойств (исчезновение в конце окна): SQL-сдвиг `ends_at` → **холодный кеш** (`docker restart <app-контейнер>`) → проверка → откат сидером/SQL → рестарт. В проде CRUD этапа 5 обязан звать `updateTag('promos')`.
30. **`usePathname()` в клиентском shell роняет build** (этап 3): с `cacheComponents` это URL-данные — «CLIENT_HOOK_DYNAMIC: blocks prerendering» на всех страницах, куда входит Header, если хук вне `<Suspense>`. Та же семья, что searchParams (§5.3): в кешируемом shell не читать ни то, ни другое. Хотел из шапки линк «Войти?redirect=<текущая» — отказались: редирект-параметр поддерживается самой страницей `/login`, шапка ведёт на голый `/login`. Полезное следствие: `next build` ловит это ДО рантайма — не откладывать build на конец этапа.

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

### Этап 1 — Корзина и чекаут (серверная корзина) — ЗАВЕРШЁН 2026-11-15 (переработан гриллингом этапа 1: скоуп-скидки, settings, доставка, поток /cart→/checkout, квитанция)

- [x] Миграция drizzle-kit: `promotions.categoryId` (nullable FK→categories, restrict — null = весь заказ) + `promotions.minTotal` (0 = без условия), `orders.deliveryFee`, таблица `settings` (key/value: `delivery_fee`, `free_delivery_threshold`); `getDeliverySettings()` — чтение settings с fallback на константы (шов для админки этапа 5); константы `DELIVERY_FEE=19900`, `FREE_DELIVERY_THRESHOLD=100000`
- [x] `lib/promo.ts`: `calcDiscount` — единый расчёт (база = весь заказ или Σ строк категории; percent `floor`, fixed `min(значение, база)`; minTotal сравнивается с полной суммой товаров) + причины неприменимости («Нужен заказ от X ₽», «В корзине нет товаров из акции»); чистые функции без `server-only` — клиент считает optimistic-тоталы той же формулой; `lib/settings.ts` `deliveryFeeFor` — единая формула доставки
- [x] Сидер — акции-заглушки до этапа 5: SHAWARMA20 −20% → шаурма, PIZZA300 −300₽ (minTotal 1000₽) → пицца, COMBO150 −150₽ → сеты; «Счастливые часы» удалены (акции без кода не применяются, Q2); CRUD акций — этап 5
- [x] Actions: `applyPromoCode` отклоняет с причиной (условия через calcDiscount), новый `removePromoCode`; `createOrder` — скидка через calcDiscount, `deliveryFee` считает сервер (бесплатно от 1 000 ₽ товаров до скидки, самовывоз 0, клиент не присылает), **протухший промо → заказ НЕ создаётся, promoId снимается, ошибка-причина → модалка (Q12)**
- [x] `/cart` (редактирование): степперы/удаление `useOptimistic`, промо-блок (доступные сверху с «Применить»/disabled+причина, активная ниже с ✕, применение другой заменяет — не складываются), поле кода + `?promo=` с inline-ошибкой, Tabs «Доставка/Самовывоз» (локальное состояние, в БД не пишется — Q19), тоталы aria-live + подсказка «до бесплатной доставки», пустое состояние; desktop — sticky-итоги справа
- [x] `/checkout` (подтверждение): товары read-only, Tabs prefilled из `?fulfillment=`, name/phone prefilled из сессии, адрес — одно textarea, комментарий; inline-валидация (aria-invalid + aria-describedby) до отправки; серверные ошибки → Dialog-модалка; пустая корзина → `redirect('/cart')`; успех → `router.push(/orders/<uuid>)`
- [x] `/orders/[id]` — квитанция (НЕ трекинг, этап 4 надстроит): статус «Создан», снапшот order_items, скидка с именем промо, доставка, итог, «Скопировать ссылку отслеживания» (clipboard + toast); доступ по неугадываемому uuid; не-uuid → not-found (§5.24-гард)
- [x] Бейдж корзины — Σqty в Suspense-слоте Header (server slot в client Header), скрыт при 0, без тегов (динамика свежая сама); `getCartForRead()` — чтение корзины страницами без создания
- [x] Гостевая корзина: httpOnly-cookie `cart_id` (с этапа 0) переживает перезагрузку; «переживает логин» + слияние — этап 3
- **Готово, когда (обновлено)**: «2×Классическая + Пепперони → SHAWARMA20 → −136 ₽ только от шаурмы → заказ создан (итого 1 234 ₽, доставка бесплатная)» — проверено браузером (web-gui-tester, скриншоты `.scratch/stage-1/screenshots/`), БД верифицирована (discountAmount=13600, deliveryFee=0, снапшот, корзина очищена)

### Этап 2 — Акции — ЗАВЕРШЁН 2026-11-16

- [x] `(shop)/promo/page.tsx`: кешируемая оболочка + список в Suspense (целиком НЕ кешируется), PromoCard
- [x] `GET /api/promotions` — ETag + `Cache-Control: public, s-maxage`
- [x] Разделение «публичная акция / скрытый промокод» (решение 2026-11-15): миграция `promotions.isPublic` (boolean NOT NULL default true); **публичные** (`isPublic = true`) — лента «Акции недели», `/promo`, `GET /api/promotions`, блок акций корзины (кнопка «Применить»); **скрытые промокоды** (`isPublic = false`) — нигде не показываются, единственный путь применения — ввод кода в поле на /cart (инпут существует именно для них: коды приходят вне приложения — рассылка, реклама); сидер: добавить `SECRET15` −15% на весь заказ (скрытый); форма этапа 5 получает переключатель публичности
- [x] Гриллинг этапа 2 (Q1–Q9): фильтр публичности — **в кешируемом WHERE** (`isActive + isPublic`, безопасность по построению; админке этапа 5 — свой `getAllPromotions()` без фильтров); `/promo` — сетка PromoCard без кнопок; API — кураторский DTO (без isActive/isPublic/createdAt), **ручной ETag** (авто-ETag Next не считается для динамических роутов), точное сравнение If-None-Match, 304 с ETag+Cache-Control (RFC 9110), `s-maxage=60`; приёмка окна — вариантом 2 (SQL-сдвиг `ends_at` + холодный кеш, §5.29). Приёмка: lint/tsc/build зелёные, docker build + prod compose (`up -d --build`, §5.28), API — 3 публичных, SECRET15 нет, 304 подтверждён; браузерный сценарий — /promo из «все →» и шапки, лента главной, ввод/снятие SECRET15 (−303 ₽ от 2 020 ₽, тоталы вернулись); БД верифицирована. Спека+5 тикетов+скриншоты — `.scratch/stage-2/`
- **Готово, когда**: 3 публичные акции из сидера видны на `/promo` и в API, скрытый `SECRET15` в них НЕ попадает (но применяется вводом кода); акция исчезает ровно в конце окна, без вмешательства в кеш

### Этап 3 — Auth (телефон) + привязка email + история заказов — ЗАВЕРШЁН 2026-11-16 (гриллинг Q1–Q5: регистрация ТОЛЬКО телефон, email — отдельный поток)

- [x] `(auth)/login` и `(auth)/register` — страницы-близнеца (общий визард «телефон → SMS-код», разница в гардах): вход по несуществующему телефону — «зарегистрируйтесь», регистрация занятого — «войдите»; SMS в обоих случаях НЕ отправляется (гард ДО `sendPhoneNumberOTP`)
- [x] Регистрация: SMS-OTP — фейк-код `1111` (консоль + `notifications` `otp.auth`) → аккаунт создаёт verify (temp-email `phone-<цифры>@temp.food.local`, формат — `lib/temp-email.ts`), `phoneVerified`, редирект `/orders`
- [x] Привязка email — **отдельный возобновляемый поток** `(auth)/email` (Q1/Q5, заменило «email + phone в форме»): `linkEmail` action (сессия; не верифицирован; уникальность с явной ошибкой; UPDATE user) → **случайный** код → Mailpit (:8025) → `emailOtp.verifyEmail` → `emailVerified`; CTA — пункт меню профиля + баннер на `/orders`, исчезают после верификации; без `SMTP_HOST` — код в консоль
- [x] Слияние гостевой корзины — `mergeGuestCartOnAuth` (клиент зовёт после verify): усыновление или транзакция (qty суммируются с капом MAX_QTY, промо юзера иначе гостя — Q4, гостевая удалена, cookie снята)
- [x] `(shop)/orders` — закрытая зона (гард → `/login`): «Текущий заказ» (created|preparing|ready|in_delivery) + «История», баннер email, пустое состояние; `getUserOrders` без 'use cache'
- [x] Шапка: авторизован — иконка «Профиль» → DropdownMenu («Мои заказы», «Привязать email» пока не верифицирован, «Выйти»), БЕЗ имени/телефона (Q3); гость — «Войти»
- **Готово, когда (приёмка 2026-11-16)**: регистрация `+7 999 555-44-33` через OTP 1111 — аккаунт + temp-email + усиновление гостевой корзины (Σqty=3 на бейдже и в БД); привязка `dodo-test@example.com` кодом из Mailpit (случайный 496845) — `emailVerified=t`, баннер исчез; повторный вход тест-юзера после гостевой покупки — merge Σ4 (`Веган x1, Пепперони x2, Маргарита x1`, гостевая удалена); вход демо-клиентом `89990000003` (нормализация 8→7, `lib/phone.ts`); негативы — ошибки-гарды, SMS не уходит; гард `/orders` гостя; lint/tsc/build + prod compose (`up -d --build`; `/api/auth/ok` → `{"ok":true}`) зелёные; скриншоты — `.scratch/stage-3/screenshots/`

### Этап 4 — Трекинг заказа

- [ ] `(shop)/orders/[id]/page.tsx` (доступ: владелец по сессии или uuid-ссылка): таймлайн статусов (иконка+текст, не только цвет)
- [ ] `GET /api/orders/[id]` + ETag (304 при неизменном статусе) + polling ~5 с; `loading.tsx`, `not-found.tsx`, `error.tsx`
- **Готово, когда**: гость по uuid-ссылке видит статус, обновляющийся без перезагрузки

### Этап 5 — Админка + картинки

- [ ] `lib/actions/products.ts` + `promotions.ts` + `updateOrderStatus` (requireAdmin через getAdminSession, revalidateTag)
- [ ] Картинки: S3-клиент через env (`S3_ENDPOINT/S3_KEY/S3_SECRET/S3_BUCKET`), upload — FormData → sharp → PutObject; `next/image` + `remotePatterns` на endpoint; emoji — фолбэк при пустом `imageUrl`
- [ ] `/admin` — редирект на `/admin/orders` (дашборд — опция при layout), `/admin/orders` — все заказы (фильтры по статусу, useOptimistic + смена статуса, `paymentStatus`), `/admin/products` (CRUD single+set, редактор состава, upload фото), `/admin/promotions`, `/admin/users` (список: имя/телефон/email/роль/регистрация/заказы; admin — смена роли)
- [ ] Форма акций с полями условий (задел гриллинга этапа 1): имя, промокод, тип/размер скидки, скоуп-категория (`promotions.categoryId` — null = весь заказ), `minTotal`, окно дат, isActive; форма «Настройки доставки» — ключи `settings` `delivery_fee`/`free_delivery_threshold` (значения читает `getDeliverySettings()`, источник меняется без правки callers)
- [ ] `src/proxy.ts` — гард /admin: роли admin|manager (matcher); права manager внутри — при описании layout
- **Готово, когда**: гость на `/admin` → редирект; admin и manager входят; CRUD сета с составом работает; фото загружается и показывается на карточке; смена статуса мгновенно видна на трекинге

### Этап 6 — Real-time чат поддержки (WebSockets) — переопределён 2026-11-15 (AI-ассистент исключён; механизм — §5.22; независим от этапов 1–5)

- [ ] Схема (миграция drizzle-kit): `chat_threads` (uuid, `user_id` nullable — text FK, `guest_token` nullable — uuid из httpOnly-cookie `chat_token` гостя, `customer_last_read_at`/`operator_last_read_at` — непрочитанные, timestamps) + `chat_messages` (thread_id, direction `customer|operator`, sender_id nullable — text FK, text, timestamps)
- [ ] WS-шлюз `ws-gateway/` — workspace-пакет (`packages:` в pnpm-workspace.yaml; Node + `ws` + postgres-js LISTEN, порт 3001): upgrade — cookies пересылаются в `/api/auth/get-session` (оператор admin|manager → комната `operators`) либо cookie `chat_token` гостя; без идентичности — отказ; комнаты по тредам; multi-stage Dockerfile + сервисы в docker-compose.dev.yml/prod.yml
- [ ] Route Handlers: `POST /api/chat/init` — идентичность (сессия или выдача cookie `chat_token`), upsert треда, история сообщений; служебный `POST /api/chat/internal` (`x-internal-secret`) — валидация доступа к треду + INSERT + NOTIFY в транзакции
- [ ] Виджет: плавающая кнопка справа внизу на любой странице (клиентский компонент в `(shop)/layout.tsx`; WS и история — только по клику); лента + input, ARIA chat roles + aria-live, клавиатурность; бейдж непрочитанных, пока виджет закрыт
- [ ] Операторская `/admin/chats` (admin+manager, как `/admin/orders`): табы чатов в реальном времени — подписка на комнату `operators`, новый тред → новый таб (телефон клиента или «unknown»), счётчик непрочитанных; ответ из таба
- [ ] Env: `NEXT_PUBLIC_WS_URL` (dev `ws://localhost:3001`; prod — wss за TLS/Caddy, §9), `INTERNAL_API_SECRET`; Next сам WS не держит — только NOTIFY
- **Готово, когда**: гость пишет в виджет и получает ответ оператора без перезагрузки; у оператора таб появляется сам (телефон или «unknown»); история чата переживает перезагрузку; WS-upgrade без идентичности отклонён

### Этап 7 — Верификация

- [ ] `pnpm lint` + `pnpm build`
- [ ] Браузерный сценарий: главная → меню → модалка → сет в корзину → SHAWARMA20 → чекаут → трекинг; смена статуса в админке → трекинг обновился; создание акции/сета в админке; гость на `/admin` → редирект; чат: гость пишет в виджет → у оператора появился таб «unknown» → ответ оператора виден гостю без перезагрузки
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

- **Happy path клиента**: главная `/` — **меню на ней** (секции: «Акции недели» в Suspense; sticky-навигация по категориям — якорный скролл + scrollspy, поиск `?q` через searchParams; «Популярное» — §9) → модалка товара (intercepting, открывается по ссылке `/product/[id]` с главной) → корзина (серверная: `carts`/`cart_items`; гостю — httpOnly cookie `cart_id`, при логине слияние) → акции из блока корзины (публичные, кнопкой) или скрытый промокод (поле ввода) → чекаут (контакты + способ оплаты) → заказ (uuid) → трекинг `создан → готовится → готов → (в доставке → доставлен | выдан)` (+ `отменён клиентом` / `отменён заведением — не принят`), при `готов` — SMS через аутбокс, polling ~5 с (ETag → 304). Auth: вход по телефону (SMS-OTP фейк `1111`), регистрация — email + phone, email верифицируется случайным кодом из письма (Mailpit). Закрытые страницы: `/admin/*` — admin+manager; `/orders`, `/orders/[id]` (+ pay) — владелец по сессии, гостю — uuid-ссылка. Поддержка: плавающий чат-виджет на любой странице (этап 6, §5.22) — тред с операторами из `/admin/chats` (табы: телефон клиента или «unknown» для гостя)
- **API**: Route Handlers — ровно 6: `GET /api/orders/[id]`, `GET /api/promotions` (только публичные — скрытые промокоды через API не отдаются), `POST /api/chat/init` + служебный `POST /api/chat/internal` для WS-шлюза (этап 6), `/api/auth/[...all]` (send-phone-otp, sign-in phone, sign-up phone+email, verify-email, sign-out, get-session), `POST /api/payments/mock/webhook` (этап 9, HMAC), `GET /api/health` (этап 11). Server Actions — корзина (add/setQty/remove), `createOrder`, `applyPromoCode`, `updateOrderStatus`, `updateUserRole` (admin), CRUD products (вкл. set_items)/categories/promotions; оплата — через webhook-роут (не action); событийные уведомления — аутбокс + флушер; автоджоба — модуль, не action. Каталог/акции/заказы читаются в RSC из БД напрямую, без HTTP.
- **Каталог**: `type single|set`, состав сетов в `set_items`, выгода — зачёркнутая старая цена, фото из MinIO (`imageUrl`) или emoji-фолбэк

## 9. Roadmap после MVP

Рассылка акций (email-кампании через аутбокс + верстка писем — задел готов: email у пользователя, Mailpit в dev), настоящий SMS-провайдер (замена консольной заглушки), PWA-пуши (Web Push), настоящий платёжный провайдер (замена `MockProvider` — новый файл + env), возвраты/refund (нужны для отмены оплаченных заказов), роли персонала (кухня/курьер, KDS), модификаторы (размер/тесто) и слоты/зоны доставки, лояльность, TLS/домен (Caddy), Sentry (задел — `error_events`), автоматические бэкапы по расписанию (pg_dump-скрипт — этап 11), rate limiting, e2e-тесты (vitest + Playwright), managed Postgres при serverless-переезде, managed S3/R2 вместо MinIO.

## 10. Правила ведения этого файла

1. После завершения этапа: отметить чекбоксы `[x]`, обновить раздел 3 «Текущее состояние», закоммитить.
2. Новые решения и грабли дописывать в раздел 5, не удаляя старые.
3. Этот файл — источник правды; чат и память агента — только указатели на него.

## 11. Приложение — состав кодовой базы

Фактический состав — источник правды в репозитории, не в этом файле (исторический снимок этапа 0 — история git до `4624a23`; в живой документ не переносить — осадок, §10). Навигация по новым модулям:

- Схема и доменные перечисления — `src/db/schema.ts`; правила скидки/доставки — `lib/promo.ts` + `lib/delivery.ts` (единые для сервера и клиента); формы — `lib/schemas/` (react-hook-form + zod, тип = `z.infer`)
- Queries — `queries/`, server actions — `lib/actions/` (`ActionResult`), общие типы корзины — `lib/cart-types.ts`, клиентский пересчёт тоталов — `lib/cart-totals.ts`
- Магазин — `components/shop/` (cart-badge, cart-interactive, promo-block, checkout-form, counter, order-totals и др.); маршруты — `src/app/**` (cart/checkout/orders — этап 1; promo, api/promotions — этап 2)

- Браузерная приёмка — рецепт в `docs/agents/browser-testing.md` (§5.25)
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
