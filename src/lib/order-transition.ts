import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import type { OrderStatus } from '@/db/schema'
import { notifications, orderStatusEvents, orders } from '@/db/schema'
import { isUuid } from '@/lib/id'
import { orderReadySms } from '@/lib/notifications/order-ready'
import { fulfillmentOf, isOrderStatus, nextStatuses } from '@/lib/order-timeline'
import type { ActionResult } from '@/lib/types'

/**
 * Ядро смены статуса (этап 10, Q3): вынесено из Server Action updateOrderStatus,
 * чтобы админка и автоджоба шли через ОДИН набор гвардов — «любая смена статуса
 * пишет событие» выполняется по построению. Без auth и без кеш-вызовов:
 * auth — в обёртках (action: requireAdmin; джоба: системный вызов), кеш — в
 * action-обёртке (джоба вне request-контекста; заказы читаются без 'use cache').
 *
 * Гварды (унаследованы, тексты ошибок — дословно, UX админки не меняется):
 * карта nextStatuses (вперёд по своему fulfillment), оплаченные не отменяются
 * никогда (refund вне скоупа), кухня не стартует неоплаченный онлайн-заказ
 * (этап 9, Q18), сбор on_receipt при передаче (этап 9, Q21). Гонка гасится
 * conditional UPDATE (паттерн cancelOrder). SMS «заказ готов» — строка аутбокса
 * в той же транзакции (этап 10, Q6): заказ проходит ready ровно один раз,
 * значит строка рождается ровно одна.
 */
export async function transitionOrderStatus(
	orderId: string,
	next: string,
): Promise<ActionResult<{ status: OrderStatus }>> {
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(orderId)) return { data: null, error: 'Заказ не найден' }
	if (!isOrderStatus(next)) return { data: null, error: 'Недопустимый статус' }

	const [order] = await db
		.select({
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			paymentMethod: orders.paymentMethod,
			fulfillment: orders.fulfillment,
			phone: orders.phone,
		})
		.from(orders)
		.where(eq(orders.id, orderId))
	if (!order) return { data: null, error: 'Заказ не найден' }
	if (!isOrderStatus(order.status)) return { data: null, error: 'Заказ в недопустимом статусе' }

	const fulfillment = fulfillmentOf(order.fulfillment)
	if (!nextStatuses(order.status, fulfillment).includes(next)) {
		return { data: null, error: 'Недопустимый переход статуса' }
	}
	if (next === 'cancelled_by_vendor' && order.paymentStatus !== 'pending') {
		return { data: null, error: 'Оплаченный заказ отменить нельзя' }
	}

	// этап 9, Q18: кухня не стартует неоплаченный онлайн-заказ — оплата резервом.
	// Живой отказ админом (cancelled_by_vendor) не гвардится — человек решает сам.
	const isOnlinePending = order.paymentMethod === 'online' && order.paymentStatus === 'pending'
	if (next === 'preparing' && isOnlinePending) {
		return { data: null, error: 'Заказ ожидает оплаты' }
	}

	// этап 9, Q21: при получении деньги собраны в момент передачи — доставка/выдача
	// оплаченного on_receipt-заказа переворачивает paymentStatus в той же транзакции
	const collectOnReceipt =
		order.paymentMethod === 'on_receipt' &&
		order.paymentStatus === 'pending' &&
		(next === 'delivered' || next === 'picked_up')

	const updated = await db.transaction(async (tx) => {
		const rows = await tx
			.update(orders)
			.set({
				status: next,
				...(collectOnReceipt ? { paymentStatus: 'paid' as const } : {}),
				updatedAt: new Date(),
			})
			.where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
			.returning({ id: orders.id })
		if (rows.length === 0) return false // гонка: статус ушёл вперёд между select и update

		await tx.insert(orderStatusEvents).values({ orderId, status: next })

		// SMS «заказ готов» — аутбокс в той же транзакции, что и событие (§5.16):
		// откатится вместе со статусом, дубли не рождаются (ready проходится один раз)
		if (next === 'ready') {
			await tx.insert(notifications).values({
				channel: 'sms',
				event: 'order.ready',
				payload: {
					to: order.phone,
					text: orderReadySms(orderId, fulfillment),
					orderId,
					fulfillment,
				},
			})
		}
		return true
	})

	if (!updated) return { data: null, error: 'Статус уже изменён — обновите список' }

	return { data: { status: next }, error: null }
}
