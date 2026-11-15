import { eq } from 'drizzle-orm'
import { db } from '@/db'
import type { Order, OrderItem, Promotion } from '@/db/schema'
import { orderItems, orders, promotions } from '@/db/schema'

export type OrderDetails = {
	order: Order
	items: OrderItem[]
	promo: Promotion | null
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
