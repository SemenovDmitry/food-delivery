import { and, eq, inArray, ne } from 'drizzle-orm'
import { db } from '@/db'
import { orders, paymentMethods, payments } from '@/db/schema'
import { env } from '@/lib/env'
import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { getPaymentProvider, signHmac, WEBHOOK_SIGNATURE_HEADER } from '@/lib/payments'
import { getRequestId } from '@/lib/request-id'
import { paymentConfirmSchema } from '@/lib/schemas/payment'

const log = logger.child({ component: 'payments' })

/**
 * POST /api/payments/mock/confirm (этап 9, Q1-Б) — «бэкенд провайдера»:
 * браузер pay-страницы бьёт сюда (секрет HMAC в бандл не попадает), роут
 * серверно подписывает payload и делает loopback HTTP POST на
 * /api/payments/mock/webhook — контракт webhook отрабатывает по-настоящему
 * при каждом клике. Доступ — как у страницы: знание uuid = пропуск
 * (паттерн cancelOrder, гриллинг Q11a-семья), отдельной проверки сессии нет.
 *
 * Провайдер-осведомлённость: одна мок-реализация за всеми банками (Q12) —
 * code оседает в payments.provider, externalId присваивает provider.initiate.
 */

type ConfirmOk = { outcome: string; redirectUrl: string | null }
type ConfirmError = { error?: string; outcome?: string; redirectUrl?: string | null }

export async function POST(request: Request): Promise<Response> {
	// Секрет — из env-схемы (этап 11): строка гарантирована (lenient-фолбэк build,
	// strict prod). Раньше fail-fast был внутри хендлера (семья §5.3) — теперь
	// падение с читаемым списком происходит на старте контейнера.
	const secret = env.PAYMENTS_WEBHOOK_SECRET

	const parsed = paymentConfirmSchema.safeParse(await request.json().catch(() => null))
	if (!parsed.success) {
		return Response.json({ error: 'Некорректный запрос' } satisfies ConfirmError, { status: 400 })
	}
	const { orderId, providerCode, action } = parsed.data
	// §5.24: кривой uuid (z.uuid уже отсек, дублирование — контракт гварда) → 404
	if (!isUuid(orderId))
		return Response.json({ error: 'Заказ не найден' } satisfies ConfirmError, { status: 404 })

	const [order] = await db
		.select({ id: orders.id, paymentMethod: orders.paymentMethod })
		.from(orders)
		.where(eq(orders.id, orderId))
	if (order?.paymentMethod !== 'online') {
		return Response.json({ error: 'Заказ не найден' } satisfies ConfirmError, { status: 404 })
	}

	const [payment] = await db
		.select()
		.from(payments)
		.where(
			and(
				eq(payments.orderId, orderId),
				ne(payments.status, 'paid'),
				ne(payments.status, 'cancelled'),
			),
		)
	if (!payment) {
		// paid/cancelled не найдены живыми = заказ уже оплачен или закрыт —
		// редирект на трекинг, там честный статус/баннер
		return Response.json(
			{ outcome: 'conflict', redirectUrl: `/orders/${orderId}` } satisfies ConfirmError,
			{ status: 409 },
		)
	}

	if (action === 'pay') {
		const [provider] = providerCode
			? await db
					.select({ code: paymentMethods.code })
					.from(paymentMethods)
					.where(and(eq(paymentMethods.code, providerCode), eq(paymentMethods.isActive, true)))
			: []
		if (!provider) {
			return Response.json(
				{ error: 'Онлайн-оплата недоступна — выберите другой способ' } satisfies ConfirmError,
				{ status: 409 },
			)
		}
		// externalId присваивает провайдер (шов Q6); redirectUrl игнорируем —
		// пользователь уже на странице провайдера
		const initiated = await getPaymentProvider().initiate({ orderId, amount: payment.amount })
		// повторная попытка = та же строка (unique order_id), новый externalId (Q7);
		// conditional UPDATE — cancelled/paid между select и записью не перезаписываем
		const updated = await db
			.update(payments)
			.set({
				provider: provider.code,
				status: 'processing',
				externalId: initiated.externalId,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(payments.id, payment.id),
					inArray(payments.status, ['created', 'failed', 'processing']),
				),
			)
			.returning({ id: payments.id })
		if (updated.length === 0) {
			return Response.json(
				{ outcome: 'conflict', redirectUrl: `/orders/${orderId}` } satisfies ConfirmError,
				{
					status: 409,
				},
			)
		}
	} else {
		// «Отмена» на банке: provider/externalId не трогаем, только фаза
		const updated = await db
			.update(payments)
			.set({ status: 'processing', updatedAt: new Date() })
			.where(
				and(
					eq(payments.id, payment.id),
					inArray(payments.status, ['created', 'failed', 'processing']),
				),
			)
			.returning({ id: payments.id })
		if (updated.length === 0) {
			return Response.json(
				{ outcome: 'conflict', redirectUrl: `/orders/${orderId}` } satisfies ConfirmError,
				{
					status: 409,
				},
			)
		}
	}

	// ─── loopback: серверная подпись → настоящий POST на webhook ───────────────
	const payload = JSON.stringify({
		paymentId: payment.id,
		status: action === 'pay' ? 'paid' : 'failed',
	})
	const signature = signHmac(payload, secret)
	const webhookUrl = `${new URL(request.url).origin}/api/payments/mock/webhook`

	let webhookStatus = 0
	let webhookOutcome: string | null = null
	try {
		const webhookResponse = await fetch(webhookUrl, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				[WEBHOOK_SIGNATURE_HEADER]: signature,
			},
			body: payload,
		})
		webhookStatus = webhookResponse.status
		webhookOutcome = (await webhookResponse.json().catch(() => null))?.outcome ?? null
	} catch (error) {
		log.error(
			{ err: error, requestId: await getRequestId(), orderId },
			'payments/mock/confirm: loopback webhook упал',
		)
		return Response.json({ error: 'Платёжный провайдер недоступен' } satisfies ConfirmError, {
			status: 500,
		})
	}

	if (action === 'cancel') {
		// failed-ветка: пользователь остаётся на шаге выбора банка (Q19)
		if (webhookStatus === 200) {
			return Response.json({ outcome: 'applied', redirectUrl: null } satisfies ConfirmOk)
		}
		return Response.json(
			{ outcome: webhookOutcome ?? 'conflict', redirectUrl: null } satisfies ConfirmError,
			{
				status: webhookStatus === 409 ? 409 : 500,
			},
		)
	}

	// pay-ветка: успех → return_url на трекинг; expired/conflict → страница разрулит
	if (webhookStatus === 200) {
		return Response.json({
			outcome: webhookOutcome ?? 'applied',
			redirectUrl: `/orders/${orderId}`,
		} satisfies ConfirmOk)
	}
	return Response.json(
		{
			outcome: webhookOutcome ?? 'conflict',
			redirectUrl: `/orders/${orderId}`,
		} satisfies ConfirmError,
		{ status: webhookStatus === 409 ? 409 : 500 },
	)
}
