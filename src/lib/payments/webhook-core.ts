import { and, eq, inArray, notInArray } from 'drizzle-orm'
import { db } from '@/db'
import { orderStatusEvents, orders, payments } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { ACTIVE_STATUSES } from '@/lib/order-timeline'
import type { WebhookEvent } from './types'
import { paymentWindowMinutes } from './window'

/**
 * Общее ядро обработки события webhook'а (этап 9, Q5/Q17) — без HTTP: роут
 * /api/payments/mock/webhook маппит исходы в коды ответа. Идемпотентность —
 * conditional UPDATE: повторный webhook (replay) не меняет БД и даёт
 * 'duplicate'. Деньги не спорят с жизнью заказа: терминальная отмена и
 * просрочка окна проверяются ДО применения paid (409-семейство).
 */

/** Исходы → коды ответа в роуте: applied|duplicate → 200, missing → 404, conflict|expired → 409 */
export type PaymentEventOutcome = 'applied' | 'duplicate' | 'missing' | 'conflict' | 'expired'

/** Терминальные отмены заказа — платёж разрешить нельзя (Q5: paid на отменённом не появится) */
const CANCELLED_ORDER_STATUSES = [
	'cancelled_by_customer',
	'cancelled_by_vendor',
	'cancelled_by_timeout',
] as const

export async function applyPaymentEvent(event: WebhookEvent): Promise<PaymentEventOutcome> {
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(event.paymentId)) return 'missing'

	const [payment] = await db.select().from(payments).where(eq(payments.id, event.paymentId))
	if (!payment) return 'missing'

	const [order] = await db
		.select({
			id: orders.id,
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			paymentMethod: orders.paymentMethod,
			createdAt: orders.createdAt,
		})
		.from(orders)
		.where(eq(orders.id, payment.orderId))
	if (!order) return 'missing'

	return db.transaction(async (tx) => {
		// 1) заказ уже отменён (любая причина) — платёж закрывается, деньги не применяются:
		// refund не в скоупе, но paid на отменённом заказе не появится (Q5)
		if ((CANCELLED_ORDER_STATUSES as readonly string[]).includes(order.status)) {
			await tx
				.update(payments)
				.set({ status: 'cancelled', updatedAt: new Date() })
				.where(eq(payments.id, payment.id))
			return 'conflict'
		}

		// 2) TTL-гард (ленивая проверка окна, Q17): просроченный онлайн-заказ
		// отменяется системой — paid сквозь просрочку не проходит. Conditional
		// UPDATE по статусу (прецедент cancelOrder): между select и транзакцией
		// cancelOrder мог успеть отменить заказ — тогда БД не трогаем
		const windowMs = paymentWindowMinutes() * 60 * 1000
		const expired =
			order.paymentMethod === 'online' &&
			order.paymentStatus === 'pending' &&
			order.createdAt.getTime() + windowMs < Date.now()
		if (expired) {
			const timedOut = await tx
				.update(orders)
				.set({ status: 'cancelled_by_timeout', updatedAt: new Date() })
				.where(
					and(
						eq(orders.id, order.id),
						eq(orders.paymentStatus, 'pending'),
						inArray(orders.status, [...ACTIVE_STATUSES]), // не-cancelled к этому моменту
					),
				)
				.returning({ id: orders.id })
			if (timedOut.length === 0) {
				// гонка: заказ уже отменён (customer/vendor) — как ветка 1
				await tx
					.update(payments)
					.set({ status: 'cancelled', updatedAt: new Date() })
					.where(eq(payments.id, payment.id))
				return 'conflict'
			}
			await tx
				.update(payments)
				.set({ status: 'cancelled', updatedAt: new Date() })
				.where(eq(payments.id, payment.id))
			await tx
				.insert(orderStatusEvents)
				.values({ orderId: order.id, status: 'cancelled_by_timeout' })
			return 'expired'
		}

		if (event.status === 'paid') {
			// paid на failed/cancelled — деньги спорят с прошлым исходом; повтор =
			// новый externalId и processing (confirm), не обход webhook'ом
			if (payment.status === 'failed' || payment.status === 'cancelled') return 'conflict'
			const paidPayments = await tx
				.update(payments)
				.set({ status: 'paid', updatedAt: new Date() })
				.where(
					and(eq(payments.id, payment.id), inArray(payments.status, ['created', 'processing'])),
				)
				.returning({ id: payments.id })
			const paidOrders = await tx
				.update(orders)
				.set({ paymentStatus: 'paid', updatedAt: new Date() })
				.where(
					and(
						eq(orders.id, order.id),
						eq(orders.paymentStatus, 'pending'),
						notInArray(orders.status, [...CANCELLED_ORDER_STATUSES]),
					),
				)
				.returning({ id: orders.id })
			if (paidPayments.length > 0 && paidOrders.length === 0) {
				// payment применился, заказ — нет: либо уже paid (replay частичного
				// применения), либо concurrently отменён (Q5: paid на отменённом не появится)
				const [fresh] = await tx
					.select({ status: orders.status })
					.from(orders)
					.where(eq(orders.id, order.id))
				if (fresh && (CANCELLED_ORDER_STATUSES as readonly string[]).includes(fresh.status)) {
					await tx
						.update(payments)
						.set({ status: 'cancelled', updatedAt: new Date() })
						.where(eq(payments.id, payment.id))
					return 'conflict'
				}
				return 'duplicate'
			}
			// 0 строк в обеих = идемпотентный replay (уже оплачен) — БД не изменилась
			return paidPayments.length === 0 && paidOrders.length === 0 ? 'duplicate' : 'applied'
		}

		// event.status === 'failed' (Q19: «Отмена» на банке)
		if (payment.status === 'paid') return 'conflict' // деньги уже списаны — failed ложно
		const failedPayments = await tx
			.update(payments)
			.set({ status: 'failed', updatedAt: new Date() })
			.where(and(eq(payments.id, payment.id), inArray(payments.status, ['created', 'processing'])))
			.returning({ id: payments.id })
		// заказ не трогается — окно ещё живёт, можно повторить (шаг 1 pay-страницы)
		return failedPayments.length === 0 ? 'duplicate' : 'applied'
	})
}
