# 11: Приёмка этапа 5 — браузерный сценарий + docker + AGENTS

**What to build:** Браузерная приёмка по рецепту `docs/agents/browser-testing.md` (**прочитать до первой приёмки в сессии**, §5.25), скриншоты — `.scratch/stage-5/screenshots/`. Сценарий: гость и customer на `/admin` → `/login`; вход admin (`+7 999 000-00-01`) и manager (`…-02`) — разная навигация, manager на admin-only → redirect; заказы: select статуса → трекинг покупателя ≤25 с (ETag 304/200), негативы (paid-cancel, назад, гонка); товары: сет с составом, фото upload → карточка+витрина+`/_next/image` заголовки, deactivate (пропал из меню / жив в корзине), delete из сета → toast, DnD внутри категории мышь+клавиатура; категории: DnD reorder → порядок на главной (нав+секции), delete с товарами → toast; акции: create/правка → витрина без холодного кеша (updateTag), delete → безымянная скидка на старой квитанции (Q23); юзеры: поиск, ban живьём → сессия умирает на следующем guarded-запросе, archive → скрыт, заказы атрибутированы; настройки: 199→299 → корзина. lint/tsc/build; docker build + prod compose (`up -d --build`, §5.28) — smoke + фото в prod (hostname `minio`) + возврат dev (§5.26); клавиатурный проход по админке (§7: DnD-клавиатура, Dialog-ловушки, таблицы). AGENTS: чекбоксы `[x]`, §3 срез, коммит.

**Blocked by:** 03, 04, 05, 06, 07, 08, 09, 10

**Status:** ready-for-agent

- [ ] Браузерный сценарий целиком, скриншоты сняты
- [ ] lint/tsc/build зелёные
- [ ] docker build + prod compose + возврат dev
- [ ] Клавиатурный a11y-проход
- [ ] AGENTS обновлён, коммит
