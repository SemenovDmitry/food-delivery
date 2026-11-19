'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath, updateTag } from 'next/cache'
import { db } from '@/db'
import type { OrderStatus } from '@/db/schema'
import {
	cartItems,
	carts,
	orderItems,
	orderStatusEvents,
	orders,
	payments,
	promotions,
} from '@/db/schema'
import { getCartLines, getOrCreateCart } from '@/lib/cart'
import { MAX_QTY } from '@/lib/constants'
import { deliveryFeeFor } from '@/lib/delivery'
import { isUuid } from '@/lib/id'
import { logger } from '@/lib/logger'
import { refundCancelOrder } from '@/lib/payments/refund'
import { getRequestId } from '@/lib/request-id'

const log = logger.child({ component: 'orders' })

import { transitionOrderStatus } from '@/lib/order-transition'
import { getPaymentProvider } from '@/lib/payments'
import { calcDiscount, isPromoInWindow, toCalcLines } from '@/lib/promo'
import type { CheckoutFormValues } from '@/lib/schemas/checkout'
import { checkoutFormSchema } from '@/lib/schemas/checkout'
import { enforceNotBlocked, getSession, requireAdmin } from '@/lib/session'
import { getDeliverySettings } from '@/lib/settings'
import type { ActionResult } from '@/lib/types'
import { hasActivePaymentProvider } from '@/queries/payments'

export type CreateOrderPayload = CheckoutFormValues

/** payUrl доезжает только для онлайн-оплаты: редирект на страницу провайдера (этап 9) */
export type CreateOrderResult = { orderId: string; payUrl?: string }

/** Снятие промокода с корзины (кто виноват — решает вызывающий) */
async function clearCartPromo(cartId: string) {
	await db.update(carts).set({ promoId: null, updatedAt: new Date() }).where(eq(carts.id, cartId))
	revalidatePath('/')
}

/**
 * createOrder: состав из корзины в БД (не из клиента), снапшот цен,
 * ревалидация промокода И способа оплаты на сервере, транзакция,
 * revalidateTag('orders') (§5.10 + гриллинг этапа 1).
 * Валидация — та же zod-схема, что и на клиенте (единственный источник правил),
 * но парсим её ЗДЕСЬ: данные из клиента не доверяем (§5.10).
 * Оплата (этап 9, Q15/Q20): online ревалидируется против payment_methods
 * (паттерн промокода) — выключенный пока форма была открыта, отсекается здесь.
 */
export async function createOrder(
	payload: CreateOrderPayload,
): Promise<ActionResult<CreateOrderResult>> {
	await enforceNotBlocked() // бан/архив режут мутации (этап 5, Q14); гость проходит
	const parsed = checkoutFormSchema.safeParse(payload)
	if (!parsed.success) {
		return {
			data: null,
			error: parsed.error.issues[0]?.message ?? 'Проверьте данные заказа',
		}
	}
	const { customerName, phone, fulfillment, address, comment, paymentMethod } = parsed.data

	// ревалидация способа оплаты: on_receipt валиден всегда; online — только
	// при ≥1 активном провайдере (Q20: оба выключены → мягкий отказ до создания заказа)
	if (paymentMethod === 'online' && !(await hasActivePaymentProvider())) {
		return { data: null, error: 'Онлайн-оплата временно недоступна' }
	}

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

	// сумма платежа = всё уже посчитано сервером (скидка от корзины, доставка от settings)
	const paymentAmount = subtotal - discountAmount + deliveryFee
	let payUrl: string | undefined

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
				paymentMethod,
			})
			.returning({ id: orders.id })

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

		// онлайн-оплата: строка payment рождается вместе с заказом (Q2 — одна
		// на заказ); externalId допишет initiate после коммита
		if (paymentMethod === 'online') {
			await tx.insert(payments).values({ orderId: order.id, amount: paymentAmount })
		}

		// корзина очищена после оформления
		await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id))
		await tx.update(carts).set({ promoId: null }).where(eq(carts.id, cart.id))

		return order.id
	})

	// initiate — вне транзакции (внешний вызов не живёт в транзакциях, §5.10).
	// Провал не откатывает заказ (Q8): payment-строка есть, externalId допишет
	// confirm при попытке оплаты, пользователь платит через CTA на трекинге
	if (paymentMethod === 'online') {
		try {
			const initiated = await getPaymentProvider().initiate({ orderId, amount: paymentAmount })
			await db
				.update(payments)
				.set({ externalId: initiated.externalId, updatedAt: new Date() })
				.where(eq(payments.orderId, orderId))
			payUrl = initiated.redirectUrl
		} catch (error) {
			// осознанно warn (не error): это handled-деградация — заказ жив,
			// оплату клиент сделает позже через CTA на трекинге
			log.warn(
				{ err: error, orderId, requestId: await getRequestId() },
				'createOrder: initiate провайдера упал — оплата позже через CTA',
			)
		}
	}

	// Server Action + read-your-own-writes → updateTag (revalidateTag(tag) в v16 deprecated)
	updateTag('orders')
	revalidatePath('/')
	return { data: payUrl ? { orderId, payUrl } : { orderId }, error: null }
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
 * Отмена клиентом (этап 4, гриллинг Q12): created|preparing; оплаченный онлайн
 * — refund-отмена (этап 14, lib/payments/refund.ts). Доступ — как у страницы:
 * владелец или держатель uuid-ссылки, отдельной проверки сессии нет. Гонка
 * гасится conditional UPDATE (тексты — дословно, этап 4).
 */
export async function cancelOrder(orderId: string): Promise<ActionResult<{ cancelled: true }>> {
	await enforceNotBlocked()

	const result = await refundCancelOrder(orderId, 'customer', {
		raceError: 'Заказ уже в работе — отменить нельзя',
	})
	if (result.data) revalidatePath('/orders')
	return result.data === null ? result : { data: { cancelled: true }, error: null }
}

/**
 * Смена статуса админкой (этап 5, Q3): тонкая обёртка над ядром
 * transitionOrderStatus (этап 10, Q3) — здесь только auth и кеш-вызовы,
 * все гварды/транзакция/события/SMS живут в ядре и общие с автоджобой.
 */
export async function updateOrderStatus(
	orderId: string,
	next: string,
): Promise<ActionResult<{ status: OrderStatus }>> {
	await requireAdmin() // живой гвард (этап 5, Q14); не-admin → срез сессии + /login

	const result = await transitionOrderStatus(orderId, next)
	if (result.data) {
		// Server Action + read-your-own-writes → updateTag (revalidateTag(tag) в v16 deprecated)
		updateTag('orders')
		revalidatePath('/admin/orders')
	}
	return result
}
