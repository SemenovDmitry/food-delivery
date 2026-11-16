import { asc, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import type { Order, OrderItem, Promotion } from '@/db/schema'
import { orderItems, orders, promotions } from '@/db/schema'

export type OrderDetails = {
	order: Order
	items: OrderItem[]
	promo: Promotion | null
}

export type UserOrder = {
	order: Order
	items: OrderItem[]
}

/**
 * Заказ с составом-снапшотом и промо (квитанция этапа 1, трекинг этапа 4).
 * Без 'use cache': персональные данные (§11).
 */
export async function getOrderById(orderId: string): Promise<OrderDetails | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
	if (!order) return null

	const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))

	let promo: Promotion | null = null
	if (order.promoId) {
		const [found] = await db.select().from(promotions).where(eq(promotions.id, order.promoId))
		promo = found ?? null
	}

	return { order, items, promo }
}

/**
 * Все заказы владельца (история, этап 3): новые сверху + состав одним запросом
 * (без N+1). Без 'use cache' — персональные данные (§11).
 */
export async function getUserOrders(userId: string): Promise<UserOrder[]> {
	const userOrders = await db
		.select()
		.from(orders)
		.where(eq(orders.userId, userId))
		.orderBy(desc(orders.createdAt))
	if (userOrders.length === 0) return []

	const items = await db
		.select()
		.from(orderItems)
		.where(
			inArray(
				orderItems.orderId,
				userOrders.map((order) => order.id),
			),
		)
		.orderBy(asc(orderItems.id))

	return userOrders.map((order) => ({
		order,
		items: items.filter((item) => item.orderId === order.id),
	}))
}
