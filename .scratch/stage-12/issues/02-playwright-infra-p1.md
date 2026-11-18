# 02: Playwright-инфраструктура (оркестратор, e2e-БД, webServer-массив) + P1 смоук

**What to build:** dev-dep `@playwright/test`; chromium-браузер (`pnpm exec playwright install chromium`). **Оркестратор** `scripts/e2e-run.mjs` (node, Windows-безопасно — pnpm-скрипты идут через cmd, `VAR=x cmd` не работает): (1) проверка postgres :5560 доступна (иначе падение с подсказкой `docker compose -f docker-compose.dev.yml up -d`); (2) `scripts/e2e-db-setup.mjs` — идемпотентно: подключение к postgres-БД → `food_delivery_e2e` создаётся если нет (SELECT pg_database → CREATE DATABASE) → `drizzle-kit migrate` с DATABASE_URL=`postgresql://postgres:postgres@localhost:5560/food_delivery_e2e` → сидер `tsx src/db/seed.ts` с тем же DATABASE_URL (идемпотентен, создаёт бакет MinIO — minio должен быть поднят); (3) `next build` c env `DATABASE_URL=e2e`, `NEXT_PUBLIC_WS_URL=ws://localhost:3001` (пекётся, §5.32-г), `DEMO_AUTO_STATUS=false`; (4) `playwright test` (env наследуется). Скрипты: `"test:e2e": "node scripts/e2e-run.mjs"`. **playwright.config.ts**: testDir `e2e/`, `workers: 1`, один project chromium, `fullyParallel: false`, testTimeout 60_000, expect timeout 10_000 (полл-ассерты — свой timeout ≤ 35_000, Q5), reporter `[['list'], ['html', { open: 'never' }]]`, `use.baseURL http://localhost:3000`, `reuseExistingServer: !process.env.CI`; **webServer-массив**: app `pnpm exec next start` (:3000) с env-блоком всех prod-required секретов (lib/env.ts strict при NODE_ENV=production: DATABASE_URL e2e, AUTH_SECRET, INTERNAL_API_SECRET, PAYMENTS_WEBHOOK_SECRET, S3_*, BETTER_AUTH_URL=http://localhost:3000, DEMO_AUTO_STATUS=false, NEXT_PUBLIC_WS_URL не нужен на рантайме — пекётся) + gateway `pnpm exec tsx ws-gateway/src/index.ts` (:3001, env DATABASE_URL e2e + WS_ALLOWED_ORIGINS=http://localhost:3000 + INTERNAL_API_SECRET тот же) — Q11. **Helper'ы** `e2e/helpers.ts`: `adminContext()` — API-логин админа (better-auth: send-otp `1111` → verify через fetch, кука сессии в newContext/browser-context storageState — эндпоинты сверить по `app/api/auth/[...all]` и better-auth докам в node_modules); `randomPhone()` — `+7 900 XXX-XX-XX` уникальный на ран; константы демо-аккаунтов из §4 AGENTS. **P1 смоук** `e2e/p1-smoke.spec.ts` (Q10): главная — нав 5 категорий + «Акции недели» с карточками (сидер-данные); корзина — добавить товар с главной → бейдж Σqty, /cart степпер qty → перезагрузка страницы → qty сохранился (кука cart_id), удалить → пустое состояние; чекаут гостя — форма (имя/телефон/адрес) → заказ создан → редирект /orders/[uuid] → квитанция (состав, суммы) + бейдж «Создан» + трекинг-страница отрисовалась; корзина после заказа пуста.

**Blocked by:** 01

**Status:** resolved

- [x] `@playwright/test` + chromium; скрипты `test:e2e`; `scripts/e2e-run.mjs` + `scripts/e2e-db-setup.mjs`
- [x] `playwright.config.ts`: workers 1, chromium-only, webServer-массив app+gateway (env-блоки strict-runtime), reuseExistingServer
- [x] `e2e/helpers.ts`: phoneSessionCookies (API-логин better-auth send-otp+verify), randomPhone
- [x] `e2e/p1-smoke.spec.ts`: главная / корзина / чекаут гостя / квитанция+трекинг / корзина очищена
- [x] `pnpm test:e2e` зелёный — **3/3 за 9.5 с** (полный пайплайн с build ~2.5 мин); e2e-БД `food_delivery_e2e` создана оркестратором

## Comments

- 2026-11-18 (реализация): **главная находка — §5.39**: Next 16 держит предыдущие деревья маршрутов в DOM скрытыми (Activity-ресторация при back-навигации) — `getByText` ловит скрытые `/cart`/`/checkout` (strict-violation на 3 элемента, с `exact: true` — «hidden» на видимой странице); правило «текстовые ассерты — только role-локаторы» задокументировано в AGENTS §5.39, оба падения прогонов были об этом.
- Изоляция БД верифицирована psql: dev 21 заказ (не тронут, канон этапа 11), e2e — 3 заказа/3 юзера (прогоны + сидер).
- `spawnSync(..., { shell: true })` даёт DeprecationWarning DEP0190 — косметика: pnpm на Windows без shell не стартует; вывод stdio inherit.
- Веб-серверы в конфиге ждут «строковый» env — хелпер `envOf` фильтрует undefined из process.env (тип ProcessEnv string|undefined vs Playwright Record<string,string>).
- `.gitignore` += `playwright-report/`, `test-results/`.
