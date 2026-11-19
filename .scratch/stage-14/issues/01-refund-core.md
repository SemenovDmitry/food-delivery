# 01: Ядро refund + шов провайдера + гварды

**What to build:** (спека этапа 14 — решения 1–5, 10) **Без миграций**. `src/db/schema.ts`: `PAYMENT_STATUSES` += `'refunding'`, `'refunded'` (text-константа, паттерн `cancelled_by_timeout`). `lib/payments/types.ts`: `WebhookEvent.status` += `'refunded'`; `PaymentProvider` — опциональный метод `refund?(input: { externalId: string; amount: number }): Promise<{ refundId: string }>` (комментарий: настоящий провайдер подтверждает возврат webhook'ом refunded; мок — синхронный). `lib/payments/mock.ts`: `MockProvider.refund` — мгновенный успех (`mock_refund_${randomUUID()}`); `verifyWebhook` принимает `status: 'refunded'`. `lib/payments/refund.ts` — общая refund-отмена (клиент и админ): read order+payment → online+paid иначе ошибка «Оплаченный заказ отменить нельзя» (on_receipt-страховка, недостижимо на активных) → tx1: conditional UPDATE orders → `cancelled_by_customer|cancelled_by_vendor` (по caller'у) + payments → `refunding` + строка `order_status_events` → **вне tx** `provider.refund()` (mock fail-fast внутри вызова — урок этапа 6) → tx2: payments `refunding → refunded` conditional (0 строк = refund уже применился webhook'ом — ок) → revalidatePath у action-обёртки. Ядро webhook: `applyPaymentEvent` ветка `refunded` — conditional UPDATE `paid|refunding → refunded` (replay → duplicate; pending/cancelled/failed → conflict). Гварды: `cancelOrder` (actions/orders.ts) — снять запрет paid: paid-ветка уходит в refund-функцию; `transitionOrderStatus` (order-transition.ts) — гвард «Оплаченный заказ отменить нельзя» только для on_receipt+paid (страховка), для online+paid `cancelled_by_vendor` → refund-путь ядра (та же lib/payments/refund.ts, статус vendor). SMS/уведомления о возврате — вне скоупа (спека #9). Юнит-тесты: MockProvider.refund форма refundId; verifyWebhook refunded (валидный HMAC/кривая подпись); только чистые функции — БД-пути приёмкой.

**Blocked by:** —

**Status:** open

- [ ] `PAYMENT_STATUSES` += refunding/refunded; `WebhookEvent.status` += refunded; `PaymentProvider.refund?`
- [ ] `MockProvider.refund` (мгновенный) + `verifyWebhook` принимает refunded
- [ ] `lib/payments/refund.ts` — refund-отмена (tx1 отмена+refunding → provider.refund вне tx → tx2 refunded), общий для cancelOrder/transitionOrderStatus
- [ ] Гварды: cancelOrder paid-ветка → refund; transitionOrderStatus «Оплаченный…» — только on_receipt-страховка, online+paid → refund
- [ ] applyPaymentEvent: refunded-ветка (идемпотентно)
- [ ] Юнит-тесты чистых частей (refund-форма, verifyWebhook refunded) зелёные
- [ ] lint/tsc×2/unit зелёные
