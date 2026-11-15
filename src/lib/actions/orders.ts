'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import { cartItems, carts, orderItems, orders, promotions } from '@/db/schema'
import { getCartLines, getOrCreateCart } from '@/lib/cart'
import { isPromoInWindow } from '@/lib/promo'
import { getSession } from '@/lib/session'
import type { ActionResult } from '@/lib/types'

export type CreateOrderPayload = {
	customerName: string
	phone: string
	fulfillment: 'delivery' | 'pickup'
	address?: string
	comment?: string
}

/**
 * createOrder: состав из корзины в БД (не из клиента), снапшот цен,
 * ревалидация промокода, транзакция, revalidateTag('orders') (§5.10).
 */
export async function createOrder(
	payload: CreateOrderPayload,
): Promise<ActionResult<{ orderId: string }>> {
	const customerName = payload.customerName?.trim() ?? ''
	const phone = payload.phone?.trim() ?? ''
	const fulfillment = payload.fulfillment
	const address = payload.address?.trim() ?? ''
	const comment = payload.comment?.trim() ?? ''

	if (customerName.length < 2) {
		return { ok: false, error: 'Укажите имя' }
	}
	if (phone.replace(/\D/g, '').length < 10) {
		return { ok: false, error: 'Укажите корректный телефон' }
	}
	if (fulfillment !== 'delivery' && fulfillment !== 'pickup') {
		return { ok: false, error: 'Некорректный способ получения' }
	}
	if (fulfillment === 'delivery' && address.length < 5) {
		return { ok: false, error: 'Укажите адрес доставки' }
	}

	const cart = await getOrCreateCart()
	const lines = await getCartLines(cart.id)
	if (lines.length === 0) {
		return { ok: false, error: 'Корзина пуста' }
	}

	// Ревалидация промокода на сервере: isActive + окно дат (§5.3)
	let promo: typeof promotions.$inferSelect | null = null
	if (cart.promoId) {
		const [found] = await db.select().from(promotions).where(eq(promotions.id, cart.promoId))
		if (found?.isActive && isPromoInWindow(found, new Date())) {
			promo = found
		}
	}

	const total = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0)
	const discountAmount = promo
		? promo.discountType === 'percent'
			? Math.floor((total * promo.discountValue) / 100)
			: Math.min(promo.discountValue, total)
		: 0

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
				promoId: promo?.id ?? null,
				discountAmount,
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

		// корзина очищена после оформления
		await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
		await tx.update(carts).set({ promoId: null }).where(eq(carts.id, cart.id))

		return order.id
	})

	// Server Action + read-your-own-writes → updateTag (revalidateTag(tag) в v16 deprecated)
	updateTag('orders')
	revalidatePath('/')
	return { ok: true, data: { orderId } }
}

/** applyPromoCode: валидация на сервере, promo_id на корзину */
export async function applyPromoCode(code: string): Promise<ActionResult<{ name: string }>> {
	const normalized = code?.trim().toUpperCase() ?? ''
	if (!normalized) return { ok: false, error: 'Введите промокод' }

	const [promo] = await db.select().from(promotions).where(eq(promotions.code, normalized))
	if (!promo?.isActive) {
		return { ok: false, error: 'Промокод не найден' }
	}

	const now = new Date()
	if (!isPromoInWindow(promo, now)) {
		return { ok: false, error: 'Срок действия промокода истёк' }
	}

	const cart = await getOrCreateCart()
	await db
		.update(carts)
		.set({ promoId: promo.id, updatedAt: new Date() })
		.where(eq(carts.id, cart.id))

	revalidatePath('/')
	return { ok: true, data: { name: promo.name } }
}
