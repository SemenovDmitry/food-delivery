# 03: GET /api/orders/[id] — DTO, ручной ETag, 404

**What to build:** `src/app/api/orders/[id]/route.ts` (Next 16: `params` — Promise). Гард `isUuid` до БД (§5.24) → 404; `getOrderById` → null → 404. DTO `{status, paymentStatus, updatedAt: ISO-string}` — без личных полей (Q14); ручной strong ETag = sha256 тела, точное сравнение `If-None-Match`, 304 повторяет ETag+Cache-Control (RFC 9110; паттерн `GET /api/promotions`); `Cache-Control: private, no-store` (персональные данные — Q5; контраст с акциями `public, s-maxage=60`). Доступ — только существование uuid (uuid = пропуск, Q11a); сессию не читаем. Роут динамический по чтению request — `connection()` не нужен (§5.3). Комментарий в файле — почему manual ETag (авто-ETag Next для динамических роутов не считается).

**Blocked by:** —

**Status:** resolved

- [x] DTO-тип отдельный (контракт ≠ схема БД — паттерн PublicPromotionDto)
- [x] 200: ETag + Cache-Control + Content-Type json; 304: ETag + Cache-Control, пустое тело
- [x] Не-uuid/не-найден → `Response(null, {status: 404})`
- [x] curl-проверка: 200 → повтор с If-None-Match → 304; сдвиг статуса SQL → 200 с новым телом
