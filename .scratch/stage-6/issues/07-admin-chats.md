# 07: Операторская /admin/chats — табы в реальном времени

**What to build:** Операторская для admin+manager — страница рядом с заказами (вне admin-only зоны), гард layout'а админки уже есть; RSC-часть по граблю админ-страниц §5.33: `connection()` + Suspense, список до 50 тредов по последнему сообщению (JOIN user → телефон, unread-подсчёт, `operator_last_read_at` в DTO) → hydration в клиентскую консоль. Консоль: WS connect → `subscribe-operators`; табы: заголовок телефон/«unknown» + бейдж непрочитанных (customer-сообщения после `operator_last_read_at`, пересчёт по каждому NOTIFY); пустые треды не показываются — таб появляется по первому message-NOTIFY (телефон в payload). Открытие таба → Server Action истории (гард requireAdmin + enforceNotBlocked — internal-роут браузеру недоступен) + WS `read`. Ответ — инпут таба → `send` через тот же релей (ack/error/message, dedupe, optimistic tempId). Живой приход в открытом табе → авто-read. Закрытие таба — только UI-состояние. Клейма нет — все операторы видят все треды (Q6); два оператора одновременно получают одинаковые broadcast. AdminNav: пункт «Чаты», adminOnly: false.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] Страница + RSC-список (connection+Suspense, ≤50 тредов, phone/unknown, unread)
- [ ] Action истории с гардами (requireAdmin + enforceNotBlocked)
- [ ] Консоль: subscribe-operators, новые табы по NOTIFY, бейджи непрочитанных на табах
- [ ] Ответ из таба через WS-релей (send/read, dedupe); авто-read открытого таба
- [ ] AdminNav + «Чаты» (adminOnly: false); manager видит операторскую
- [ ] Ручная проверка: два оператора в двух вкладках видят табы и сообщения одновременно
