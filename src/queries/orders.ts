import { asc, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import type { Order, OrderItem, Promotion } from '@/db/schema'
import { orderItems, orders, promotions } from '@/db/schema'
import { ACTIVE_STATUSES, isOrderStatus, TERMINAL_STATUSES } from '@/lib/order-timeline'

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

// ─── Админка (этап 5) ────────────────────────────────────────────────────────

export type AdminOrderRow = {
	order: Order
	/** Σ позиций (шт) */
	itemCount: number
	/** формула квитанции: Σ позиций − скидка + доставка */
	total: number
}

/**
 * Все заказы для /admin/orders (этап 5, Q10/Q19): фильтр по статусу
 * (все/активные/терминальные/конкретный), новые сверху, пагинация.
 * Без 'use cache' — персональные данные (§11); СВОБОДНО от §5.29: мутации
 * статуса (updateOrderStatus) зовут updateTag('orders') + revalidatePath.
 */
export async function getAdminOrders({
	filter,
	page,
	perPage,
}: {
	filter: string
	page: number
	perPage: number
}): Promise<{
	rows: AdminOrderRow[]
	total: number
}> {
	const where =
		filter === 'active'
			? inArray(orders.status, [...ACTIVE_STATUSES])
			: filter === 'terminal'
				? inArray(orders.status, [...TERMINAL_STATUSES])
				: isOrderStatus(filter)
					? eq(orders.status, filter)
					: undefined

	const list = await db
		.select()
		.from(orders)
		.where(where)
		.orderBy(desc(orders.createdAt))
		.limit(perPage)
		.offset((page - 1) * perPage)
	const [{ value: total }] = await db.select({ value: count() }).from(orders).where(where)
	if (list.length === 0) return { rows: [], total }

	const items = await db
		.select({ orderId: orderItems.orderId, price: orderItems.price, qty: orderItems.qty })
		.from(orderItems)
		.where(
			inArray(
				orderItems.orderId,
				list.map((order) => order.id),
			),
		)

	return {
		rows: list.map((order) => {
			const own = items.filter((item) => item.orderId === order.id)
			return {
				order,
				itemCount: own.reduce((sum, item) => sum + item.qty, 0),
				total:
					own.reduce((sum, item) => sum + item.price * item.qty, 0) -
					order.discountAmount +
					order.deliveryFee,
			}
		}),
		total,
	}
}
