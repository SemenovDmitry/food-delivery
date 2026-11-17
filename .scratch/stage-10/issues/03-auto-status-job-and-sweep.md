# 03: lib/jobs/auto-status — тик (свип всегда + продвижение) + instrumentation.ts

**What to build:** `src/lib/jobs/auto-status.ts` — тик `autoStatusTick()` (экспорт для смоука) + `startAutoStatusJob()`: reentrancy-флаг (тик, застрявший дольше интервала, пропускается); **(1) свип — всегда**: кандидаты по предикату TTL-гарда webhook-core (`paymentMethod='online' AND paymentStatus='pending' AND status IN ACTIVE_STATUSES AND createdAt + window < now`, `paymentWindowMinutes()` из `lib/payments/window.ts`), по-заказные транзакции — шейп ветки expired webhook-core: conditional UPDATE заказа → `cancelled_by_timeout`, payment → `cancelled` по orderId, строка в `order_status_events`; сбой одного заказа логируется, партия продолжается; **(2) продвижение — под `DEMO_AUTO_STATUS=true`**: кандидаты `status IN ACTIVE_STATUSES AND updatedAt <= now - intervalMs` → по заказу `nextStatuses(status, fulfillment)[0]`; в точке `created→preparing` для `on_receipt`+pending — рол `Math.random() < rate` → `cancelled_by_vendor` вместо шага; иначе — переход через ядро тикета 01 (гвард кухни сам отказывает неоплаченным онлайн — лог+skip); переходы пишут события и SMS-строку по построению ядра. Чтение env по образцу `window.ts`: `isAutoStatusEnabled()` (`true`/`1`), `autoStatusIntervalMs()` (дефолт 60000, кламп ≥ 5000), `autoCancelRate()` (дефолт 0.1, кламп 0..1). `src/instrumentation.ts` — `register()`: globalThis-гвард, гвард `NEXT_PHASE === 'phase-production-build'`, старт `startFlusher()` + `startAutoStatusJob()` (setInterval без блокирующих await); console.log старта (единственная строка на процесс — проверка синглтона). Env: `.env.example` — `DEMO_AUTO_STATUS=true` (+коммент prod off), коммент к `DEMO_AUTO_STATUS_INTERVAL` («тик автоджобы, мс»), новый `DEMO_AUTO_CANCEL_RATE=0.1`; локальный `.env` — `DEMO_AUTO_STATUS=true`. Логи переходов/свипа — `console.log` с коротким id (pino — этап 11).

**Blocked by:** 01, 02

**Status:** resolved

- [x] Свип: предикат зеркален webhook-core, по-заказные tx (заказ+payment+событие), отказоустойчив per-order; работает при `DEMO_AUTO_STATUS=false`
- [x] Продвижение: per-order elapsed (`updatedAt`), один шаг за тик, до терминала; неоплаченные online не продвигаются; `delivered`/`picked_up` on_receipt → paid (ядро)
- [x] Рол: одиночный в `created→preparing`, on_receipt-only, ставка `DEMO_AUTO_CANCEL_RATE`
- [x] `instrumentation.ts`: оба цикла стартуют, globalThis-гвард (одна строка старта в логах), NEXT_PHASE-гвард; dev `pnpm dev` — джоба живёт
- [x] `.env.example` + локальный `.env` обновлены (`DEMO_AUTO_STATUS=true`, `DEMO_AUTO_CANCEL_RATE=0.1`)
- [x] Смоук tsx против dev-БД: свип на подсаженном просроченном online-заказе → `cancelled_by_timeout` + payment `cancelled` + событие; оплаченный онлайн-заказ свипом не тронут
- [x] lint + `tsc --noEmit` зелёные

## Comments

- 2026-11-18 (реализация): or(ne(...), ne(...)) вместо not(and(...)) — тип not(and()) в drizzle возвращает | undefined. Смоук 24/24: свип C (online+pending, createdAt за окном) → cancelled_by_timeout + payment cancelled + событие; D (online PAID) не свипнут и продвинут; полные цепочки delivery/pickup до терминала со сбором on_receipt; флаг off — заказы не двигаются, флаг on — оживают. pnpm dev живьём: обе строки старта по одному разу (.next/dev/logs/), тик через 60 с продвинул dev-заказы, флушер отправил их SMS ≤30 с — полный цикл. NEXT_PHASE-гвард — эмпирическая проверка на docker build осталась на приёмку (тикет 04). Неоплаченные online исключены из выборки продвижения De Morgan-условием (гвард ядра остаётся страховкой).
- Честная заметка: первый прогон смоука (до изоляции) тиком продвинул ~6 старых dev-заказов приёмки этапа 9 (их updatedAt был древним) и отправил их SMS — отката нет; в dev это штатное поведение включённой автоджобы (Q10), свип чужие заказы не трогал (swept=1 — только свой). Смоук переписан с изоляцией (свежий updatedAt чужим активным заказам) и перезакладкой updatedAt между тиками.
