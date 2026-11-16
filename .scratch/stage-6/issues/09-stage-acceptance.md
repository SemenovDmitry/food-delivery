# 09: Приёмка этапа 6 — curl + браузер + SQL + docker

**What to build:** Полная приёмка по рецепту `docs/agents/browser-testing.md` (читать ДО первой приёмки в сессии, §5.25; Radix-грабли §5.34). curl/API: init гостя (Set-Cookie + тред) → повторно тот же threadId; internal без секрета 403, чужой тред forbidden, длинный текст validation; WS-upgrade без кук и без `chat_token` → отказ. Браузер (web-gui-tester, скриншоты `.scratch/stage-6/screenshots/`): Т1 — гость на главной открывает виджет, пишет; Т2 — у оператора (второй профиль/вкладка) появился таб «unknown» с бейджем; Т3 — ответ оператора виден гостю БЕЗ перезагрузки (`performance.timeOrigin` неизменен — прецедент этапа 4); Т4 — перезагрузка страницы гостя → история чата на месте; Т5 — клиент логинится → гостевой тред усыновлён (SQL user_id), в операторской таб стал телефоном; Т6 — остановить шлюз → инпут disabled «Нет соединения», старт → восстановление, история целостна; Т7 — непрочитанные: ответ оператора при закрытом виджете → бейдж ≤30 с (localStorage-гейт: до первого открытия поллинга нет), новое сообщение при закрытом табе оператора → бейдж таба; Т8 — два оператора видят тред одновременно. SQL-верификация: строки chat_messages (direction/sender_id), `*_last_read_at`, усиновление. Прочее: `pnpm lint` + tsc ×2 + `pnpm build` зелёные; docker build; prod compose `up -d --build` (§5.28) — smoke чата в prod; возврат dev (§5.26); AGENTS §3/§6 — чекбоксы [x] + приёмка-заметки; финальный коммит «Этап 6».

**Blocked by:** 06, 07, 08

**Status:** ready-for-agent

- [ ] curl-сценарии: init ×2, internal-негативы (403/forbidden/validation), upgrade-отказ
- [ ] Браузерные Т1–Т8 со скриншотами в `.scratch/stage-6/screenshots/`
- [ ] SQL-верификация: messages, last_read_at, усиновление
- [ ] lint/tsc×2/build; docker build + prod compose (`up -d --build`) + smoke + возврат dev
- [ ] AGENTS §3/§6 обновлён (чекбоксы [x], приёмка), коммит «Этап 6»
