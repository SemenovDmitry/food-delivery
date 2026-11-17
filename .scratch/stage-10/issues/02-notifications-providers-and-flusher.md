# 02: lib/notifications — провайдеры + флушер

**What to build:** `src/lib/notifications/providers.ts` — seam для roadmap-замены на настоящих провайдеров (новый файл + env, без переделки логики): интерфейс провайдера канала (send по payload, throw при сбое), SMS-имплементация — консоль-заглушка по образцу `sendOTP` из auth.ts (`[SMS-заглушка] текст → номер`), Email-имплементация — обертка существующего `sendEmail` ([src/lib/email.ts](E:\repositories\food-delivery\src\lib\email.ts)); payload email-контракт `{to, subject, text, html?}` (продюсеров в этапе нет — шов приёмится подсадкой). `src/lib/notifications/flusher.ts` — `setInterval`-синглтон 30 с: `SELECT` из `notifications` `status='pending' ORDER BY createdAt LIMIT 20` → по строке провайдер по `channel` → `UPDATE status='sent' | 'failed'` (+`error`), per-row try/catch (сбой одной строки не роняет партию); **failed — терминален, без ретраев**; неизвестный канал → failed «Нет провайдера для канала» (чистый путь проверки failure-ветки). Экспорты: `flushOnce()` (смоук через `pnpm tsx -e`, паттерн смоука ядра этапа 9) и `startFlusher()` (подключит тикет 03 в instrumentation). Провайдер выбирается фабрикой по каналу — fail-fast внутри вызова (урок этапа 6: module-level throw валит build).

**Blocked by:** —

**Status:** resolved

- [x] `providers.ts`: SmsProvider (консоль) + EmailProvider (sendEmail) + фабрика по `channel`
- [x] `flusher.ts`: батч 20 по createdAt, per-row sent|failed(+error), failed терминален, `flushOnce()` + `startFlusher()`
- [x] Смоук tsx: подсадная SQL-строка sms → `flushOnce()` → консоль-лог + строка `sent`; email-строка → письмо в Mailpit (:8025, SMTP_HOST=localhost:1025 в dev)
- [x] Failure-ветка: строка с неизвестным каналом → `failed` + error, повторный флуш её не трогает
- [x] lint + `tsc --noEmit` зелёные

## Comments

- 2026-11-18 (реализация): провайдеры валидируют payload (readString — malformed → throw → failed с причиной); фабрика бросает внутри вызова (урок этапа 6). Смоук: sms/email → sent (письмо верифицировано через API Mailpit :8025 — Subject «Smoke 10 email» найден), канал «pigeon» → failed «Нет провайдера…», второй тик не трогает (updatedAt не изменился). jsonb-payload приходит unknown — каст на шве флушера, валидация внутри провайдера.
