# 02: Ядро чата — identity→тред, INSERT+NOTIFY, чтения, протокол, GLOSSARY

**What to build:** Единое место механики треда (server-only модуль в lib): (1) резолв треда по identity `{kind:'customer',userId} | {kind:'guest',token} | {kind:'operator',userId,role}` — find по `user_id`/`guest_token`; если у юзера своего треда нет, но по его `chat_token`-куке нашёлся гостевой — **усиновление** (UPDATE user_id, Q2; потоки сообщений не мержить, осиротевший гостевой тред принят); (2) вставка сообщения в транзакции с `pg_notify('chat', JSON: {threadId, phone|null, message:{id, direction, text, createdAt, senderId}})` — телефон клиента джойнится в момент вставки и кладётся в payload, чтобы шлюз оставался без БД-чтений (кап 2000 символов гарантирует < 8 КБ — лимит NOTIFY); (3) чтения: последние 50 сообщений треда (ORDER BY id), список тредов операторской (до 50 по последнему сообщению desc, JOIN user ради телефона, только с ≥1 customer-сообщением — пустышки не показываются), unread-подсчёты (customer-сообщения после `operator_last_read_at` и симметрично), update нужного `*_last_read_at`. Client-safe модуль с типами WS-протокола (без server-only): клиент→шлюз `subscribe{threadId}` / `subscribe-operators` / `send{threadId,text,tempId}` / `read{threadId}`; шлюз→клиенту `ack{tempId,message}` / `error{tempId?,code}` / `message{threadId,phone,message}`; коды ошибок validation|forbidden|banned|unavailable. GLOSSARY.md — термины: «тред поддержки», «операторская», «направление сообщения», «WS-комната».

**Blocked by:** 01

**Status:** resolved

- [x] Резолв identity→тред с upsert и усиновлением (только когда своего нет)
- [x] INSERT+pg_notify в одной транзакции, payload с телефоном (< 8 КБ — коммент-обоснование)
- [x] Чтения: история ≤50, лента операторской ≤50 (phone/unknown, без пустышек), unread, last_read_at
- [x] Типы протокола обеих сторон + коды ошибок, client-safe
- [x] GLOSSARY: 4 термина чата в формате файла
- [x] Верификация SQL: NOTIFY виден в LISTEN-скрипте, усиновление не трогает чужие треды
