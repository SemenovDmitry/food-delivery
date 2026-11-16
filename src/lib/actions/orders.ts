'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import type { OrderStatus } from '@/db/schema'
import { cartItems, carts, orderItems, orderStatusEvents, orders, promotions } from '@/db/schema'
import { getCartLines, getOrCreateCart } from '@/lib/cart'
import { MAX_QTY } from '@/lib/constants'
import { deliveryFeeFor } from '@/lib/delivery'
import { isUuid } from '@/lib/id'
import {
	CANCELLABLE_STATUSES,
	type Fulfillment,
	isOrderStatus,
	nextStatuses,
} from '@/lib/order-timeline'
import { calcDiscount, isPromoInWindow, toCalcLines } from '@/lib/promo'
import type { CheckoutFormValues } from '@/lib/schemas/checkout'
import { checkoutFormSchema } from '@/lib/schemas/checkout'
import { enforceNotBlocked, getSession, requireAdmin } from '@/lib/session'
import { getDeliverySettings } from '@/lib/settings'
import type { ActionResult } from '@/lib/types'

export type CreateOrderPayload = CheckoutFormValues

/** Снятие промокода с корзины (кто виноват — решает вызывающий) */
async function clearCartPromo(cartId: string) {
	await db.update(carts).set({ promoId: null, updatedAt: new Date() }).where(eq(carts.id, cartId))
	revalidatePath('/')
}

/**
 * createOrder: состав из корзины в БД (не из клиента), снапшот цен,
 * ревалидация промокода и расчёт доставки на сервере, транзакция,
 * revalidateTag('orders') (§5.10 + гриллинг этапа 1).
 * Валидация — та же zod-схема, что и на клиенте (единственный источник правил),
 * но парсим её ЗДЕСЬ: данные из клиента не доверяем (§5.10).
 */
export async function createOrder(
	payload: CreateOrderPayload,
): Promise<ActionResult<{ orderId: string }>> {
	await enforceNotBlocked() // бан/архив режут мутации (этап 5, Q14); гость проходит
	const parsed = checkoutFormSchema.safeParse(payload)
	if (!parsed.success) {
		return {
			data: null,
			error: parsed.error.issues[0]?.message ?? 'Проверьте данные заказа',
		}
	}
	const { customerName, phone, fulfillment, address, comment } = parsed.data

	const cart = await getOrCreateCart()
	const lines = await getCartLines(cart.id)
	if (lines.length === 0) {
		return { data: null, error: 'Корзина пуста' }
	}

	// Ревалидация промокода: активен + окно + условия. Протухший промо
	// снимается с корзины, заказ НЕ создаётся (гриллинг этапа 1, Q12)
	let promoId: string | null = null
	let discountAmount = 0
	if (cart.promoId) {
		const [found] = await db.select().from(promotions).where(eq(promotions.id, cart.promoId))
		if (!found?.isActive || !isPromoInWindow(found, new Date())) {
			await clearCartPromo(cart.id)
			return { data: null, error: 'Промокод больше не действует' }
		}
		const discount = calcDiscount(toCalcLines(lines), found)
		if (!discount.applicable) {
			await clearCartPromo(cart.id)
			return { data: null, error: discount.reason }
		}
		promoId = found.id
		discountAmount = discount.amount
	}

	const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0)
	const delivery = await getDeliverySettings()
	// Порог бесплатной доставки — от суммы товаров ДО скидки; самовывоз всегда 0
	const deliveryFee = deliveryFeeFor(fulfillment, subtotal, delivery)

	const session = await getSession()

	const orderId = await db.transaction(async (tx) => {
		const [order] = await tx
			.insert(orders)
			.values({
				userId: session?.user.id ?? null,
				customerName,
				phone,
				fulfillment,
				address: fulfillment === 'delivery' ? address : null,
				comment: comment || null,
				promoId,
				discountAmount,
				deliveryFee,
				status: 'created',
				paymentStatus: 'pending',
			})
			.returning()

		await tx.insert(orderItems).values(
			lines.map((line) => ({
				orderId: order.id,
				productId: line.product.id,
				name: line.product.name, // снапшот названия и цены из БД
				price: line.product.price,
				qty: line.qty,
			})),
		)

		// история статусов (этап 4, Q15a): первая строка — момент создания;
		// писатели последующих смен — cancelOrder / этап 5 / этап 10
		await tx.insert(orderStatusEvents).values({ orderId: order.id, status: 'created' })

		// корзина очищена после оформления
		await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
		await tx.update(carts).set({ promoId: null }).where(eq(carts.id, cart.id))

		return order.id
	})

	// Server Action + read-your-own-writes → updateTag (revalidateTag(tag) в v16 deprecated)
	updateTag('orders')
	revalidatePath('/')
	return { data: { orderId }, error: null }
}

/** applyPromoCode: валидация на сервере (активность, окно, условия), promo_id на корзину */
export async function applyPromoCode(code: string): Promise<ActionResult<{ name: string }>> {
	await enforceNotBlocked()
	const normalized = code?.trim().toUpperCase() ?? ''
	if (!normalized) return { data: null, error: 'Введите промокод' }

	const [promo] = await db.select().from(promotions).where(eq(promotions.code, normalized))
	if (!promo?.isActive) {
		return { data: null, error: 'Промокод не найден' }
	}

	if (!isPromoInWindow(promo, new Date())) {
		return { data: null, error: 'Срок действия промокода истёк' }
	}

	const cart = await getOrCreateCart()
	const lines = await getCartLines(cart.id)
	const discount = calcDiscount(toCalcLines(lines), promo)
	if (!discount.applicable) {
		return { data: null, error: discount.reason }
	}

	await db
		.update(carts)
		.set({ promoId: promo.id, updatedAt: new Date() })
		.where(eq(carts.id, cart.id))

	revalidatePath('/')
	return { data: { name: promo.name }, error: null }
}

/** removePromoCode: ✕ у активной акции на /cart (гриллинг этапа 1, Q7) */
export async function removePromoCode(): Promise<ActionResult<{ removed: true }>> {
	const cart = await getOrCreateCart()
	await db.update(carts).set({ promoId: null, updatedAt: new Date() }).where(eq(carts.id, cart.id))
	revalidatePath('/')
	return { data: { removed: true }, error: null }
}

/**
 * Повтор заказа (2026-11-16): позиции снапшота → текущая корзина (qty суммируются
 * с капом MAX_QTY). Доступ как у квитанции — владелец или uuid-ссылка (гостю тоже
 * можно: повтор уедет в гостевую корзину). Удалённые товары (productId = null через
 * onDelete: set null) пропускаются — added считает только добавленные позиции.
 */
export async function repeatOrder(orderId: string): Promise<ActionResult<{ added: number }>> {
	await enforceNotBlocked()
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(orderId)) return { data: null, error: 'Заказ не найден' }

	const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId))
	if (!order) return { data: null, error: 'Заказ не найден' }

	const items = await db
		.select({ productId: orderItems.productId, qty: orderItems.qty })
		.from(orderItems)
		.where(eq(orderItems.orderId, orderId))

	const cart = await getOrCreateCart()

	let added = 0
	await db.transaction(async (tx) => {
		for (const item of items) {
			if (!item.productId) continue // товар удалён из каталога — повторить позицию нельзя
			const [existing] = await tx
				.select()
				.from(cartItems)
				.where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, item.productId)))
			if (existing) {
				await tx
					.update(cartItems)
					.set({ qty: Math.min(MAX_QTY, existing.qty + item.qty) })
					.where(eq(cartItems.id, existing.id))
			} else {
				await tx
					.insert(cartItems)
					.values({ cartId: cart.id, productId: item.productId, qty: item.qty })
			}
			added += 1
		}
	})

	revalidatePath('/')
	return { data: { added }, error: null }
}

/**
 * Отмена клиентом (этап 4, гриллинг Q12): только created|preparing и только
 * неоплаченный (оплаченные = refund — вне скоупа, этап 9). Доступ — как у
 * страницы: владелец или держатель uuid-ссылки, отдельной проверки сессии нет.
 * Повторная проверка статуса в транзакции: гонка «нажал в последний момент,
 * а заказ уже готовится» возвращает ошибку, а не отменяет после ready.
 */
export async function cancelOrder(orderId: string): Promise<ActionResult<{ cancelled: true }>> {
	await enforceNotBlocked()
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(orderId)) return { data: null, error: 'Заказ не найден' }

	const [order] = await db
		.select({ status: orders.status, paymentStatus: orders.paymentStatus })
		.from(orders)
		.where(eq(orders.id, orderId))
	if (!order) return { data: null, error: 'Заказ не найден' }
	if (order.paymentStatus !== 'pending') {
		// задел этапа 9: оплаченные не отменяем без refund-механики
		return { data: null, error: 'Оплаченный заказ отменить нельзя' }
	}

	const cancelled = await db.transaction(async (tx) => {
		const updated = await tx
			.update(orders)
			.set({ status: 'cancelled_by_customer', updatedAt: new Date() })
			.where(
				and(
					eq(orders.id, orderId),
					inArray(orders.status, [...CANCELLABLE_STATUSES]),
					eq(orders.paymentStatus, 'pending'),
				),
			)
			.returning({ id: orders.id })

		if (updated.length === 0) return false // гонка: статус ушёл вперёд между select и update
		await tx.insert(orderStatusEvents).values({ orderId, status: 'cancelled_by_customer' })
		return true
	})

	if (!cancelled) return { data: null, error: 'Заказ уже в работе — отменить нельзя' }

	revalidatePath('/orders')
	return { data: { cancelled: true }, error: null }
}

/**
 * Смена статуса админкой (этап 5, Q3): только по карте nextStatuses (вперёд по
 * своему fulfillment), оплаченные не отменяются никогда (refund — этап 9).
 * Гонка гасится conditional UPDATE в транзакции (паттерн cancelOrder); строка
 * в order_status_events — в той же транзакции (писатели статуса не ходят мимо
 * таблицы, Q15a этапа 4). SMS «заказ готов» — этап 10, здесь граница.
 */
export async function updateOrderStatus(
	orderId: string,
	next: string,
): Promise<ActionResult<{ status: OrderStatus }>> {
	await requireAdmin() // живой гвард (этап 5, Q14); не-admin → срез сессии + /login

	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(orderId)) return { data: null, error: 'Заказ не найден' }
	if (!isOrderStatus(next)) return { data: null, error: 'Недопустимый статус' }

	const [order] = await db
		.select({
			status: orders.status,
			paymentStatus: orders.paymentStatus,
			fulfillment: orders.fulfillment,
		})
		.from(orders)
		.where(eq(orders.id, orderId))
	if (!order) return { data: null, error: 'Заказ не найден' }
	if (!isOrderStatus(order.status)) return { data: null, error: 'Заказ в недопустимом статусе' }

	const fulfillment: Fulfillment = order.fulfillment === 'pickup' ? 'pickup' : 'delivery'
	if (!nextStatuses(order.status, fulfillment).includes(next)) {
		return { data: null, error: 'Недопустимый переход статуса' }
	}
	if (next === 'cancelled_by_vendor' && order.paymentStatus !== 'pending') {
		return { data: null, error: 'Оплаченный заказ отменить нельзя' }
	}

	const updated = await db.transaction(async (tx) => {
		const rows = await tx
			.update(orders)
			.set({ status: next, updatedAt: new Date() })
			.where(and(eq(orders.id, orderId), eq(orders.status, order.status)))
			.returning({ id: orders.id })
		if (rows.length === 0) return false // гонка: статус ушёл вперёд между select и update
		await tx.insert(orderStatusEvents).values({ orderId, status: next })
		return true
	})

	if (!updated) return { data: null, error: 'Статус уже изменён — обновите список' }

	updateTag('orders')
	revalidatePath('/admin/orders')
	return { data: { status: next }, error: null }
}
