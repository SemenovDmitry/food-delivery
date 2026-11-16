# 06: Виджет поддержки — кнопка, Sheet, WS-клиент, бейдж непрочитанных

**What to build:** Плавающий чат витрины (клиентский компонент в `(shop)/layout.tsx` после футера — только витрина: не на auth-страницах, не в /admin, Q8). Кнопка справа внизу (aria-label «Поддержка», бейдж счётчика). Открытие → Sheet справа (Q13 — фокус-ловушка/Esc/aria из Radix): лента сообщений (role=log, aria-live=polite), инпут + отправка (Enter), optimistic-строки с tempId (pending → подтверждение ack, error → тост по коду, echo дедуплицируется по message.id). Логика: (1) первый клик → POST init → threadId+история, флаг localStorage «чат использовался»; (2) WS connect `NEXT_PUBLIC_WS_URL` → `subscribe{threadId}`; (3) send/read через шлюз; (4) живой приход в открытом окне → авто-read (Q5); (5) закрытие Sheet → ws.close() (WS только по клику); (6) обрыв → reconnect с backoff + повторный init (история целостна), инпут disabled + подпись «Нет соединения» — HTTP-фолбэка нет (Q1, вариант C). Бейдж при закрытом виджете: Server Action `getChatUnread` (по сессии/куке chat_token; нет ни того ни другого → 0 без похода в БД) поллит 30 с, стартует только после первого открытия чата (localStorage-гейт), `document.hidden` пропускает тик (паттерн OrderTracker). A11y-чеклист §7: клавиатура, focus-visible, статус не только цветом.

**Blocked by:** 03, 05

**Status:** ready-for-agent

- [ ] Кнопка + Sheet + лента + инпут по a11y-чеклисту (role=log, aria-live, клавиатура)
- [ ] init → subscribe → send/read цикл; ack/error/message; dedupe по id; tempId-стейты
- [ ] Reconnect backoff + re-init; WS-down → инпут disabled + «Нет соединения»
- [ ] `getChatUnread` action + поллинг 30 с (localStorage-гейт, document.hidden)
- [ ] Закрытие Sheet → disconnect; на (auth) и /admin виджета нет
- [ ] Ручная проверка: диалог двух вкладок (гость/оператор) живёт без перезагрузки
