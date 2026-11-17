import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import type { Order, Payment, PaymentMethod } from '@/db/schema'
import { orders, paymentMethods, payments } from '@/db/schema'

/**
 * Контекст страницы оплаты (этап 9, тикет 05): заказ + его единственная
 * payment-строка + активные банки-провайдеры. Без 'use cache': свежесть окна
 * оплаты и статуса оплаты критична (§11-семья персональных данных).
 */
export type PayContext = {
	order: Order
	payment: Payment | null
	providers: PaymentMethod[]
}

export async function getPayContext(orderId: string): Promise<PayContext | null> {
	const [order] = await db.select().from(orders).where(eq(orders.id, orderId))
	if (!order) return null

	const [payment] = await db.select().from(payments).where(eq(payments.orderId, orderId))
	const providers = await db
		.select()
		.from(paymentMethods)
		.where(and(eq(paymentMethods.isActive, true)))
		.orderBy(asc(paymentMethods.position))

	return { order, payment: payment ?? null, providers }
}

/**
 * «Онлайн-оплата» доступна при ≥1 активном провайдере (этап 9, Q20) — общий
 * источник для чекаут-страницы (показ radio) и createOrder (ревалидация, Q15):
 * пара «виден в форме / проверен на сервере» не разъезжается (ревью — Duplicated Code).
 */
export async function hasActivePaymentProvider(): Promise<boolean> {
	const [found] = await db
		.select({ id: paymentMethods.id })
		.from(paymentMethods)
		.where(eq(paymentMethods.isActive, true))
		.limit(1)
	return found !== undefined
}
