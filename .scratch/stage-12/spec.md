# Спека: Этап 12 — Тесты (vitest + Playwright) и CI (GitHub Actions)

Гриллинг 2026-11-18, Q1–Q17, пользователь подтвердил сводку. Цель: превратить разовую ручную приёмку (этап 7) в постоянную регрессию + юнит-защита чистых функций `lib/`. Storybook — отдельный этап 13 (`.scratch/stage-13/`).

## Решения гриллинга

| Q   | Решение                                                                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Один гриллинг на оба этапа (12+13), спеки/реализация раздельные; e2e первым                                                                                                                                                                                               |
| Q2  | vitest = юниты чистых функций; e2e = **отдельный раннер `@playwright/test`** (не vitest browser mode)                                                                                                                                                                     |
| Q3  | e2e против `next build` + `next start` (прод-реалистично, cacheComponents как в prod); инфраструктура — dev-compose (postgres :5560/minio/mailpit); prod-стек не трогаем (§5.26)                                                                                          |
| Q4  | Сидер = фикстура (идемпотентен); изоляция — уникальные данные на ран (рандомные телефоны); БД не сбрасываем                                                                                                                                                               |
| Q5  | Прод-код не трогаем: Playwright-таймауты 30–35 с на полл-ассерты; env-шов `NEXT_PUBLIC_ORDER_POLL_MS` — отдельный тикет ТОЛЬКО если время сьюта станет болью                                                                                                              |
| Q6  | Pre-commit НЕ меняем — тесты вызываются руками (`pnpm test:unit` / `pnpm test:e2e`)                                                                                                                                                                                       |
| Q7  | — (Storybook, этап 13)                                                                                                                                                                                                                                                    |
| Q8  | — (Storybook, этап 13)                                                                                                                                                                                                                                                    |
| Q9  | CI = **GitHub Actions** (не gh CLI): `.github/workflows/ci.yml`, триггер `push: master` + `workflow_dispatch`; джобы unit + e2e; chromium-only; артефакт (HTML-отчёт/трейсы) при падении. Бесплатно — репо публичный. **Правка конвенции §1** («без CI» → GitHub Actions) |
| Q10 | Матрица сценариев P1 смоук → P2 ядро → P3 сложные (см. ниже); порядок реализации = приоритет                                                                                                                                                                              |
| Q11 | Gateway для чат-e2e: второй элемент webServer-массива (`tsx ws-gateway/src/index.ts`, :3001); нестабильность → `test.fixme` с комментарием, не тянет сьют                                                                                                                 |
| Q12 | Стори ко-локация (этап 13)                                                                                                                                                                                                                                                |
| Q13 | — (Storybook, этап 13)                                                                                                                                                                                                                                                    |
| Q14 | — (Storybook, этап 13)                                                                                                                                                                                                                                                    |
| Q15 | **Пуш master в конце этапа 12** (~30 накопленных коммитов + этап + workflow) — явное разрешение выдано                                                                                                                                                                    |
| Q16 | Юнит-покрытие — чистые функции без БД/сети (см. скоуп); вне скоупа: внутренности ws-gateway, actions/queries с БД, React-компоненты                                                                                                                                       |
| Q17 | БД e2e — отдельная `food_delivery_e2e` в том же postgres-контейнере; идемпотентный setup (createdb → migrate → seed); dev-данные не замусориваются                                                                                                                        |

## Скоуп юнитов (vitest, `*.test.ts` рядом с модулями в `src/lib/`)

- `lib/promo.ts` — calcDiscount (percent floor, fixed `min(value, base)`, скоуп по категории, minTotal vs полная сумма, причины), isPromoInWindow (границы), promoStateReason, filterPromosInWindow, toCalcLines
- `lib/cart-totals.ts` — computeTotals (доставка 199/бесплатно от 1000₽ от суммы ДО скидки, самовывоз 0, скидка при stateReason=null, итог)
- `lib/order-timeline.ts` — nextStatuses карта по fulfillment, ACTIVE/TERMINAL/CANCELLABLE, isOrderStatus/isTerminalStatus/fulfillmentOf
- `lib/phone.ts` — нормализация 8/+7/10 цифр/уже-нормализованный/мусор
- `lib/format.ts` — formatPrice (копейки→рубли, NBSP-разряды, запятая), formatDiscount, plural, STATUS_LABELS полнота; formatDate/DateTime — НЕ тестируем (локаль/таймзона машины)
- `lib/payments/hmac.ts` — signHmac/verifyHmac (раундтрип, подделка тела/секрета, длина подписи, 64-hex)
- `lib/id.ts` — isUuid (валидный/uppercase/мусор/обрезанный), shortOrderId
- **Находка гриллинга**: `lib/ws-protocol.ts` — type-only файл, рантайм-поверхности нет → юниты бессмысленны, исключён

## Архитектура e2e

- **Оркестратор** `pnpm test:e2e` = node-скрипт: (1) setup БД e2e (createdb если нет → drizzle-kit migrate → сидер; DATABASE_URL подменён на `food_delivery_e2e`) → (2) `next build` (env: `NEXT_PUBLIC_WS_URL=ws://localhost:3001` пекётся, `DEMO_AUTO_STATUS=false`, DATABASE_URL=e2e) → (3) `playwright test`. Windows-безопасно (pnpm-скрипты — cmd, `VAR=x cmd` не работает — потому node-оркестратор, не shell-склейка)
- **webServer-массив** в playwright.config: app (`next start`, :3000, runtime-env строго через env-блок — lib/env.ts strict при NODE_ENV=production требует все секреты) + gateway (`tsx ws-gateway/src/index.ts`, :3001, env INTERNAL_API_SECRET/WS_ALLOWED_ORIGINS/DATABASE_URL). `reuseExistingServer: !CI`
- **Инфраструктура**: dev-compose должен быть поднят; оркестратор проверяет postgres:5560 доступность, падает с подсказкой `docker compose -f docker-compose.dev.yml up -d`. В CI джоба поднимает compose сама
- **Исполнение**: chromium-only, `workers: 1` (детерминированность на общей e2e-БД), testTimeout 60 с (полл-ассерты до ~35 с)
- **Данные**: сидер = фикс­тура; регистраций — рандомные телефоны `+7 900 XXX-XX-XX` на ран; заказы/треды — свои на сценарий; сидер требует MinIO (бакет)

## Матрица e2e-сценариев

- **P1 смоук** (`e2e/p1-smoke.spec.ts`): главная рендерится (нав 5 категорий, «Акции недели» с карточками); корзина: добавить → бейдж, степпер qty → переживает перезагрузку, удалить; чекаут гостя → заказ создан → квитанция + трекинг отрисовались («Создан»), корзина очищена
- **P2 ядро** (`e2e/p2-core.spec.ts`): вход демо-клиента через UI (телефон + OTP 1111); админ (API-логин в helper'е) меняет статус на /admin/orders → трекинг обновился ≤ 35 с без перезагрузки; SHAWARMA20 кнопкой (скидка только от шаурмы — проверка итога на квитанции); SECRET15 вводом кода (и НЕ виден на витрине/в блоке акций/API); отмена клиентом (alertdialog → подтверждение → баннер + бейдж «Отменён клиентом»)
- **P3 сложные** (`e2e/p3-complex.spec.ts`): онлайн-оплата loopback (онлайн в чекауте → pay → Сбер → «Оплатить» → чип «Оплачено» ≤ 35 с); регистрация нового рандомного телефона + привязка email (код из Mailpit API :8025/api/v1/messages); чат гость↔оператор — реальный WS-шлюз, два browser-контекста (гость пишет в виджете → оператор отвечает в /admin/chats → ответ живьём ≤ 5 с; при нестабильности — `test.fixme` с комментарием)

## CI (`.github/workflows/ci.yml`)

- Триггер: `push: branches: [master]` + `workflow_dispatch`; два независимых джоба
- **unit**: checkout → pnpm/action-setup → setup-node (cache pnpm) → `pnpm install --frozen-lockfile` → lint → tsc×2 → `pnpm test:unit` (~1–2 мин)
- **e2e**: то же + `docker compose -f docker-compose.dev.yml up -d` → `playwright install chromium --with-deps` → `pnpm test:e2e` (~5–8 мин); артефакт `playwright-report/` + трейсы при падении (`if: failure()`)
- gh CLI не нужен (не установлен на машине — верификация прогона через публичную страницу Actions)

## Вне скоупа

- Внутренности ws-gateway (только запуск как веб-сервер), actions/queries с БД (покрытие = e2e), React-компоненты (покрытие = Storybook этапа 13), визуальные снапшоты (Q14 — до редизайна), firefox/webkit, vitest browser mode, тесты миграций/env-схемы (покрыты приёмкой этапа 11)

## Готово, когда

- `pnpm test:unit` зелёный локально и в CI; `pnpm test:e2e` зелёный локально (dev-compose + e2e-БД) и в CI; lint/tsc×2/build зелёные; AGENTS §1/§2/§3/§6 обновлены; **пуш master сделан** (Q15) и Actions-прогон зелёный
