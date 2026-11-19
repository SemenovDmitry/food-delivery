import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { orderStatusEvents, orders, payments } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { CANCELLABLE_STATUSES } from '@/lib/order-timeline'
import type { ActionResult } from '@/lib/types'
import { getPaymentProvider } from './index'

/**
 * Refund-отмена оплаченного онлайн-заказа (этап 14, спека решения 3/5): общая
 * для клиента (cancelOrder → cancelled_by_customer) и админа
 * (transitionOrderStatus → cancelled_by_vendor). Гвард: только online+paid —
 * on_receipt-деньги получены наличными при передаче (paid = терминальные
 * статусы, отмена по карте недостижима) — возврат невозможен.
 *
 * Порядок (внешние вызовы вне транзакций — types.ts): tx1 отменяет заказ и
 * переводит платёж в `refunding`; provider.refund() — вне tx (мок мгновенный,
 * настоящий провайдер — асинхронный, подтверждение webhook'ом refunded); tx2
 * `refunding → refunded` conditional — если провайдер успел прислать webhook
 * раньше, строки 0 и это не ошибка. Провал refund() между tx1 и tx2 оставляет
 * `refunding` — разбор вручную (warn-лог), webhook-догонит или админ.
 */

export type RefundCancelError =
	| 'not-found'
	| 'not-cancellable'
	| 'not-online-paid'
	| 'no-refund-support'
	| 'race'

/** Универсальный путь всех сценариев отмены — для обоих callers */
export async function refundCancelOrder(
	orderId: string,
	cancelledBy: 'customer' | 'vendor',
	opts?: { raceError?: string },
): Promise<ActionResult<{ cancelled: true; refunded: boolean }>> {
	// дословные тексты гонок сохранены у callers (этап 4 / этап 10)
	const raceError = opts?.raceError ?? 'Статус уже изменён — обновите страницу'
	if (!isUuid(orderId)) return { data: null, error: 'Заказ не найден' }

	const [order] = await db
		.select({
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			paymentMethod: orders.paymentMethod,
		})
		.from(orders)
		.where(eq(orders.id, orderId))
	if (!order) return { data: null, error: 'Заказ не найден' }

	// клиент отменяет created|preparing (этап 4); админ — плюс ready (карта этапа 5)
	const cancellable: readonly string[] =
		cancelledBy === 'vendor' ? [...CANCELLABLE_STATUSES, 'ready'] : [...CANCELLABLE_STATUSES]
	if (!(cancellable as readonly string[]).includes(order.status)) {
		return {
			data: null,
			error:
				cancelledBy === 'customer'
					? 'Заказ уже в работе — отменить нельзя'
					: 'Недопустимый переход статуса',
		}
	}

	const isPaid = order.paymentStatus === 'paid'
	if (isPaid && order.paymentMethod !== 'online') {
		// страховка: on_receipt-оплаченный на активном статусе невозможен
		return { data: null, error: 'Оплаченный заказ отменить нельзя' }
	}

	const nextStatus = cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_vendor'
	const targetStatuses = [...cancellable]

	if (isPaid) {
		const [payment] = await db
			.select({ id: payments.id, externalId: payments.externalId, amount: payments.amount })
			.from(payments)
			.where(eq(payments.orderId, orderId))
		if (!payment?.externalId) {
			return { data: null, error: 'Платёж не найден — возврат невозможен' }
		}
		const provider = getPaymentProvider()
		if (!provider.refund) {
			return { data: null, error: 'Провайдер оплаты не поддерживает возврат' }
		}

		const cancelled = await db.transaction(async (tx) => {
			const rows = await tx
				.update(orders)
				.set({ status: nextStatus, updatedAt: new Date() })
				.where(
					and(
						eq(orders.id, orderId),
						inArray(orders.status, [...targetStatuses]),
						eq(orders.paymentStatus, 'paid'),
					),
				)
				.returning({ id: orders.id })
			if (rows.length === 0) return false // гонка: статус ушёл вперёд
			await tx
				.update(payments)
				.set({ status: 'refunding', updatedAt: new Date() })
				.where(and(eq(payments.id, payment.id), eq(payments.status, 'paid')))
			await tx.insert(orderStatusEvents).values({ orderId, status: nextStatus })
			return true
		})
		if (!cancelled) return { data: null, error: raceError }

		// ВНЕ транзакции: внешний вызов провайдера (types.ts). Мок мгновенен;
		// настоящий — асинхронен, refunded придёт webhook'ом.
		try {
			await provider.refund({ externalId: payment.externalId, amount: payment.amount })
		} catch (error) {
			// платёж остаётся refunding — разбор вручную; настоящий провайдер
			// догонит webhook'ом refunded, повторный refund() — руками админа
			logger.warn(
				{ err: error, component: 'payments/refund', paymentId: payment.id },
				'[refund] provider.refund провалился — платёж остался в refunding',
			)
			return { data: { cancelled: true, refunded: false }, error: null }
		}
		await db
			.update(payments)
			.set({ status: 'refunded', updatedAt: new Date() })
			.where(and(eq(payments.id, payment.id), eq(payments.status, 'refunding')))
		// order-level paymentStatus → refunded: чип «Возвращено» доезжает
		// существующим поллинг-DTO без его расширения (спека #8)
		await db
			.update(orders)
			.set({ paymentStatus: 'refunded', updatedAt: new Date() })
			.where(and(eq(orders.id, orderId), eq(orders.paymentStatus, 'paid')))

		return { data: { cancelled: true, refunded: true }, error: null }
	}

	// Неоплаченный — прежний путь отмены (этап 4), conditional UPDATE
	const cancelled = await db.transaction(async (tx) => {
		const rows = await tx
			.update(orders)
			.set({ status: nextStatus, updatedAt: new Date() })
			.where(and(eq(orders.id, orderId), inArray(orders.status, [...targetStatuses])))
			.returning({ id: orders.id })
		if (rows.length === 0) return false
		await tx.insert(orderStatusEvents).values({ orderId, status: nextStatus })
		return true
	})
	if (!cancelled) return { data: null, error: raceError }
	return { data: { cancelled: true, refunded: false }, error: null }
}
