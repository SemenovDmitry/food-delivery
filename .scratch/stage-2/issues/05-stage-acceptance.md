# 05: Приёмка этапа 2

**What to build:** Верификация по чек-листу AGENTS (lint/tsc/build, docker, браузерный сценарий, тест конца окна вариантом 2 — сдвиг времени) + обновление AGENTS.md и коммит.

**Blocked by:** 01, 02, 03, 04

**Status:** resolved

- [x] `pnpm lint` (biome), `tsc --noEmit`, `pnpm build` — зелёные; pre-commit включён (`git config core.hooksPath scripts/hooks`, §5.27)
- [x] `docker build` проходит; `docker compose -f docker-compose.prod.yml up` поднимается → возврат dev-стека (`docker compose -f docker-compose.dev.yml up -d`, §5.26)
- [x] Заголовки/ETag API проверяем на **prod-сборке** (в dev Next может форсить `no-store`): `curl -i` → 200 с ETag + `Cache-Control: public, s-maxage=60`; повторный запрос с `If-None-Match` → 304
- [x] API-выдача: ровно 3 публичные акции (SHAWARMA20, COMBO150, PIZZA300); SECRET15 в JSON отсутствует
- [x] Браузерный сценарий web-gui-tester (рецепт `docs/agents/browser-testing.md` — читать ДО приёмки): главная → «все →» → `/promo`: 3 карточки, SECRET15 отсутствует; ссылка «Акции» из шапки; лента главной по-прежнему 3 карточки; `/cart`: ввод `SECRET15` → применён (−15% на весь заказ, скидка на титулах пересчитана), ✕ снимает; блок акций корзины — только публичные с кодами
- [x] Тест конца окна (вариант 2, гриллинг Q5/Q7): `docker exec -it food-postgres psql -U postgres -d food_delivery -c "UPDATE promotions SET ends_at = now() - interval '1 second' WHERE code = 'SHAWARMA20'"` → перезагрузка `/promo` и API — акции СРАЗУ нет (доказательство: фильтр на чтении, кеш не трогали); `pnpm db:seed` возвращает окно. Примечание: полный вариант (endsAt через ~70 с + реальное ожидание) проверяет ту же ветку `isPromoInWindow` — по желанию, без обязательности
- [x] Скриншоты в `.scratch/stage-2/screenshots/`
- [x] AGENTS.md: §3 (этап 2 завершён), §6 чекбоксы этапа 2, §5 — новые грабли, если вскроются; GLOSSARY — если появились новые термины
- [x] Коммит «Этап 2» (спека и тикеты коммитятся вместе с этапом, §5.11; без push — пуш по явной просьбе)

**Комментарии (факт приёмки, 2026-11-16):**

1. `docker compose up -d` без `--build` переиспользует СТАРЫЙ образ — новый `/api/promotions` отдал HTML-404. Рабочая команда: `docker compose -f docker-compose.prod.yml up -d --build` (грабль §5.28).
2. Тест конца окна (вариант 2) требует **холодного кеша**: `'use cache'` хранит снимок строк — прямой SQL-сдвиг `ends_at` невидим чтению, пока кеш тёплый (урок теста C1 этапа 1). Фактическая петля: SQL-сдвиг → `docker restart food-delivery-app-1` → /promo и API сразу без акции → восстановление → рестарт → акция вернулась (грабль §5.29).
3. Пока поднят prod-стек, postgres не публикует :5560 — хостовый `pnpm db:seed` падает ECONNREFUSED; восстановление окна в prod делалось SQL-эквивалентом значений сидера, `pnpm db:seed` прогнан после возврата dev-стека (§5.26).
4. Скриншоты: t1_promo_page, t3_home_ribbon, t4_secret15_before/applied/removed — в `screenshots/`.
