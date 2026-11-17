import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import postgres from 'postgres'
import { db } from '../src/db'
import { orderItems, orderStatusEvents, orders, payments } from '../src/db/schema'
import { getPaymentProvider, signHmac } from '../src/lib/payments'

/**
 * Смоук ядра этапа 9 (тикет 02): исходы applyPaymentEvent против реальной БД.
 * Фабрикует заказ+payment, прогоняет paid/duplicate/cancel/expired, чистит за
 * собой. Запуск: PAYMENTS_WEBHOOK_SECRET=dev-secret npx tsx scripts/smoke-payments.ts
 */

const client = postgres(
	process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5560/food_delivery',
	{ max: 2 },
)

const secret = process.env.PAYMENTS_WEBHOOK_SECRET ?? 'dev-secret'

async function makeFixtures(paymentStatus: 'pending' | 'paid', createdAt: Date) {
	const orderId = randomUUID()
	await db.insert(orders).values({
		id: orderId,
		customerName: 'Smoke Тест',
		phone: '+7 999 000-00-03',
		fulfillment: 'delivery',
		address: 'ул. Тестовая, 1',
		status: 'created',
		paymentStatus,
		paymentMethod: 'online',
		createdAt,
		updatedAt: createdAt,
	})
	await db.insert(orderItems).values({
		orderId,
		name: 'Кола 0.5',
		price: 9000,
		qty: 1,
	})
	const [payment] = await db
		.insert(payments)
		.values({ orderId, amount: 9000, status: 'processing', externalId: `mock_${randomUUID()}` })
		.returning()
	return { orderId, paymentId: payment.id }
}

async function makeCancelledFixtures() {
	const { orderId, paymentId } = await makeFixtures('pending', new Date())
	await db.update(orders).set({ status: 'cancelled_by_customer' }).where(eq(orders.id, orderId))
	return { orderId, paymentId }
}

async function cleanup(orderId: string) {
	await db.delete(orderStatusEvents).where(eq(orderStatusEvents.orderId, orderId))
	await db.delete(payments).where(eq(payments.orderId, orderId))
	await db.delete(orderItems).where(eq(orderItems.orderId, orderId))
	await db.delete(orders).where(eq(orders.id, orderId))
}

async function main() {
	const provider = getPaymentProvider()
	const headers = new Headers()

	// 1) verifyWebhook: честная подпись принимается, кривая/кривой JSON — null
	const raw = JSON.stringify({ paymentId: 'x', status: 'paid' })
	headers.set('x-payment-signature', signHmac(raw, secret))
	const ok = await provider.verifyWebhook(headers, raw)
	headers.set('x-payment-signature', 'bad')
	const badSig = await provider.verifyWebhook(headers, raw)
	headers.set('x-payment-signature', signHmac(raw, secret))
	const badJson = await provider.verifyWebhook(headers, '{"paymentId":')
	if (!ok || badSig !== null || badJson !== null) {
		throw new Error(`verifyWebhook: ok=${ok} badSig=${badSig} badJson=${badJson}`)
	}
	console.log('1. verifyWebhook: подпись ок, кривые отклонены')

	// 2) missing: неизвестный payment
	const { applyPaymentEvent } = await import('../src/lib/payments')
	const missingOutcome = await applyPaymentEvent({ paymentId: randomUUID(), status: 'paid' })
	if (missingOutcome !== 'missing') throw new Error(`missing: ${missingOutcome}`)
	console.log('2. missing: неизвестный payment → missing')

	// 3) paid → applied, replay → duplicate
	const a = await makeFixtures('pending', new Date())
	const first = await applyPaymentEvent({ paymentId: a.paymentId, status: 'paid' })
	const replay = await applyPaymentEvent({ paymentId: a.paymentId, status: 'paid' })
	const [orderA] = await db.select().from(orders).where(eq(orders.id, a.orderId))
	if (first !== 'applied' || replay !== 'duplicate' || orderA.paymentStatus !== 'paid') {
		throw new Error(`paid: first=${first} replay=${replay} order=${orderA.paymentStatus}`)
	}
	await cleanup(a.orderId)
	console.log('3. paid → applied; replay → duplicate; заказ paid')

	// 4) failed → applied, повторный failed → duplicate, paid поверх failed → conflict
	const b = await makeFixtures('pending', new Date())
	const failed = await applyPaymentEvent({ paymentId: b.paymentId, status: 'failed' })
	const failedReplay = await applyPaymentEvent({ paymentId: b.paymentId, status: 'failed' })
	const paidOverFailed = await applyPaymentEvent({ paymentId: b.paymentId, status: 'paid' })
	if (failed !== 'applied' || failedReplay !== 'duplicate' || paidOverFailed !== 'conflict') {
		throw new Error(`failed: ${failed}/${failedReplay}/${paidOverFailed}`)
	}
	await cleanup(b.orderId)
	console.log('4. failed → applied; replay → duplicate; paid поверх failed → conflict')

	// 5) отменённый заказ → conflict + payment cancelled
	const c = await makeCancelledFixtures()
	const cancelled = await applyPaymentEvent({ paymentId: c.paymentId, status: 'paid' })
	const [paymentC] = await db.select().from(payments).where(eq(payments.id, c.paymentId))
	if (cancelled !== 'conflict' || paymentC.status !== 'cancelled') {
		throw new Error(`cancelled: ${cancelled}/${paymentC.status}`)
	}
	await cleanup(c.orderId)
	console.log('5. отменённый заказ → conflict, payment cancelled')

	// 6) просрочка → expired + cancelled_by_timeout + событие
	const d = await makeFixtures('pending', new Date(Date.now() - 10 * 60 * 1000))
	const expired = await applyPaymentEvent({ paymentId: d.paymentId, status: 'paid' })
	const [orderD] = await db.select().from(orders).where(eq(orders.id, d.orderId))
	const [paymentD] = await db.select().from(payments).where(eq(payments.id, d.paymentId))
	const eventsD = await db
		.select()
		.from(orderStatusEvents)
		.where(eq(orderStatusEvents.orderId, d.orderId))
	if (
		expired !== 'expired' ||
		orderD.status !== 'cancelled_by_timeout' ||
		paymentD.status !== 'cancelled' ||
		!eventsD.some((e) => e.status === 'cancelled_by_timeout')
	) {
		throw new Error(`expired: ${expired}/${orderD.status}/${paymentD.status}/${eventsD.length}`)
	}
	await cleanup(d.orderId)
	console.log('6. просрочка → expired + cancelled_by_timeout + событие')

	await client.end()
	console.log('SMOKE OK')
}

main().catch(async (error) => {
	console.error('SMOKE FAIL:', error)
	await client.end()
	process.exit(1)
})
