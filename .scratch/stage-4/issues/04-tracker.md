# 04: OrderTracker — клиентский поллинг 25 с + рендер таймлайна

**What to build:** `components/shop/order-tracker.tsx` (`'use client'`). Пропы: `orderId`, `initialStatus`, `fulfillment`, `updatedAt` (ISO). Состояние: `status` (useState от initialStatus), `etagRef` (useRef). `setInterval` 25 с: skip при `document.hidden`; `fetch(/api/orders/${id}, { headers: If-None-Match })`; 200 → сохранить ETag, `setStatus(dto.status)`, если изменился — aria-live объявление нового STATUS_LABELS; 304 → ничего; 404/ошибка сети → молча ждём следующего тика (без UI-ошибки и бэккофа, Q6); терминальный статус (из `TERMINAL_STATUSES`) → `clearInterval`. Рендер: таймлайн из `buildTimeline` (паттерн разметки: пройденные — primary + галочка Check, current — выделен, future — muted; иконка+текст на каждом шаге — a11y «не только цветом»); отменный статус → destructive-баннер вместо таймлайна (`cancelled_by_customer`: «Вы отменили этот заказ», `cancelled_by_vendor`: «Заказ отклонён заведением») + подпись «Статус обновлён {formatDateTime}»; `prefers-reduced-motion` — без анимации пульса. React Compiler: без set-state-in-effect (тик — внутри interval-callback, не в effect-body). Cleanup: clearInterval при unmount.

**Blocked by:** 02 (buildTimeline + константы), 03 (контракт API)

**Status:** resolved

- [x] Поллинг 25 с, If-None-Match, 304 → no-op, 200 → setState
- [x] document.hidden → skip тика; ошибки — молча; терминальный → стоп навсегда
- [x] Таймлайн иконка+текст, done/current/pending; отмены — баннер вместо таймлайна
- [x] aria-live="polite" объявление смены статуса; подпись updatedAt
- [x] Cleanup интервала; ошибки fetch не копятся в UI
