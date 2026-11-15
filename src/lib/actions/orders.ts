'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import { cartItems, carts, orderItems, orders, promotions } from '@/db/schema'
import { getCartLines, getOrCreateCart } from '@/lib/cart'
import { deliveryFeeFor } from '@/lib/delivery'
import { calcDiscount, isPromoInWindow, toCalcLines } from '@/lib/promo'
import type { CheckoutFormValues } from '@/lib/schemas/checkout'
import { checkoutFormSchema } from '@/lib/schemas/checkout'
import { getSession } from '@/lib/session'
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
