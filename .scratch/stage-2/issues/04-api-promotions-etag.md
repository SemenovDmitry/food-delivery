# 04: GET /api/promotions — кураторский DTO + ручной ETag

**What to build:** Публичный Route Handler акций: только публичные и в окне, кураторский DTO, ручной ETag с 304, `Cache-Control: public, s-maxage=60`. Факты доков: авто-ETag Next не считается для динамических роутов (`sendRenderResult`: `isDynamic → payload = null`); GET-хендлеры с v15 динамические по умолчанию.

**Blocked by:** 02

**Status:** resolved

- [x] `src/app/api/promotions/route.ts`: `GET(request: Request)` — чтение `request.headers.get('if-none-match')` делает роут динамическим (нет пререндера с живой БД на docker build, §5.3)
- [x] Данные: `getCachedActivePromotions()` (публичные по кеш-фильтру тикета 02) + фильтр окна `isPromoInWindow(p, new Date())` в хендлере (вне кеша — окно точное)
- [x] DTO (контракт не повторяет схему БД): `{ id, name, code: string | null, discountType, discountValue, categoryId: number | null, minTotal, startsAt: string | null, endsAt: string | null }` — даты через `.toISOString()`; наружу не идут `isActive` (всегда true), `isPublic` (выдача публичная по определению), `createdAt`
- [x] ETag ручной: strong `"${sha256hex}"` от JSON-тела (`node:crypto` createHash); сравнение с `If-None-Match` точное — наш же ETag, учебный проект (без парсинга списков и `W/`-префикса); комментарий-обоснование
- [x] 304: пустое тело + `ETag` + `Cache-Control` (RFC 7232 §4.1 — 304 повторяет заголовки 200)
- [x] 200: `ETag` + `Cache-Control: public, s-maxage=60` + `Content-Type: application/json; charset=utf-8`; комментарий про s-maxage: CDN в проекте нет, заголовок номинальный; доковская оговорка — CDN не слышит `revalidateTag` и досидит до конца TTL (окно всё равно точное: Next не кеширует динамический handler)
- [x] Скрытые промокоды через API не отдаются (GLOSSARY) — гарантируется кеш-фильтром, собственного фильтра не добавлять; пустой список → `[]` со своим ETag
- [x] Проверка руками: два последовательных запроса — второй с `If-None-Match` → 304
