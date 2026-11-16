# 03: POST /api/chat/init — идентичность, кука, история

**What to build:** Route Handler init чата (POST, бюджет §8: 5-й из 6). Логика: (1) идентичность — сессия (`getSession`) → customer по `userId`; иначе кука `chat_token` → guest; иначе **создать** токен (crypto.randomUUID) и поставить куку `chat_token` (httpOnly, sameSite lax, path /, maxAge 30 дней — прецедент `cart_id`, константа рядом с CART_COOKIE); (2) резолв треда через ядро (upsert, усиновление гостевого при логине — Q2); (3) `customer_last_read_at = now()`; (4) ответ `{threadId, messages: последние 50}` — DTO без чувствительных полей (id/direction/text/createdAt/senderId). Rate limiting нет (Q4). Роут динамический сам по себе (чтение cookies/запроса, §5.3 — connection() в Route Handlers не нужен). БД-ошибки → 500 JSON; тело пустое допустимо (zod на будущее расширение).

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Идентичность: сессия → кука → создание токена+куки (прецедент cart_id)
- [ ] Upsert треда + усиновление гостевого при логине (свой есть → гостевой осиротеет)
- [ ] `customer_last_read_at = now()` на каждый init
- [ ] Ответ {threadId, messages ≤50} + `Cache-Control: no-store`
- [ ] curl: гость 1-й вызов → Set-Cookie + пустой тред; 2-й → тот же threadId; залогиненный → тред по userId
