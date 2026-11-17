import { revalidateTag } from 'next/cache'
import type { PaymentEventOutcome } from '@/lib/payments'
import { applyPaymentEvent, getPaymentProvider } from '@/lib/payments'

/**
 * POST /api/payments/mock/webhook (этап 9, Q1/Q5) — «приём платежки»:
 * единственный источник смены статуса оплаты, auth = ТОЛЬКО HMAC (провайдер
 * зовёт машинно, без сессий). Тело читается СЫРЫМ (request.text()) — подпись
 * считается по байтам, не по перепарсенному JSON. Исходы ядра → коды:
 * applied|duplicate → 200 (идемпотентный replay обязан быть 200), missing → 404,
 * conflict|expired → 409.
 */

// исчерпывающий маппинг (ревью): новое значение union → ошибка компиляции, не 500
const OUTCOME_STATUS: Record<PaymentEventOutcome, number> = {
	applied: 200,
	duplicate: 200,
	missing: 404,
	conflict: 409,
	expired: 409,
}

/** Исходы, меняющие заказ (не только payment-строку) — чтения должны увидеть это */
const ORDER_CHANGED: ReadonlySet<PaymentEventOutcome> = new Set(['applied', 'expired'])

export async function POST(request: Request): Promise<Response> {
	const rawBody = await request.text()
	const event = await getPaymentProvider().verifyWebhook(request.headers, rawBody)
	if (!event) return new Response(null, { status: 400 })

	const outcome = await applyPaymentEvent(event)

	if (ORDER_CHANGED.has(outcome)) {
		// Route Handler-форма revalidateTag (v16, §5.3): трекинг/заказы видят paid и timeout сразу
		revalidateTag('orders', 'max')
	}

	return new Response(JSON.stringify({ outcome }), {
		status: OUTCOME_STATUS[outcome],
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store',
		},
	})
}
