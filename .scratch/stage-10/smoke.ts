/**
 * Смоук этапа 10 против dev-БД (паттерн смоука ядра этапа 9).
 * Запуск: node --env-file=.env --import tsx .scratch/stage-10/smoke.ts
 * Проверяет тикеты 01–03: ядро переходов + SMS-строка, флушер (sent/failed,
 * Mailpit), автоджоба (свип, продвижение, инвариант оплаченных).
 * Изоляция: чужие активные заказы dev-БД получают свежий updatedAt (безопасно —
 * просто ещё один интервал ожидания), тик продвигает только смоук-заказы;
 * между тиками смоук-заказы под-backdate'ятся (per-order elapsed честный).
 * Свои тестовые строки удаляет в конце (cleanup в finally).
 */
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import { db } from '../../src/db/index'
import { notifications, orderStatusEvents, orders, payments } from '../../src/db/schema'
import { autoStatusTick } from '../../src/lib/jobs/auto-status'
import { flushOnce } from '../../src/lib/notifications/flusher'
import { orderReadySms } from '../../src/lib/notifications/order-ready'
import { ACTIVE_STATUSES } from '../../src/lib/order-timeline'
import { transitionOrderStatus } from '../../src/lib/order-transition'

// детерминизм смоука: без демо-отмен; продвижение включено
process.env.DEMO_AUTO_CANCEL_RATE = '0'
process.env.DEMO_AUTO_STATUS = 'true'

let failures = 0
function check(name: string, cond: boolean, extra?: unknown) {
	console.log(`${cond ? 'PASS' : 'FAIL'} — ${name}${cond ? '' : ` :: ${JSON.stringify(extra)}`}`)
	if (!cond) failures += 1
}

const backdated = new Date(Date.now() - 10 * 60_000)
const A = crypto.randomUUID() // on_receipt delivery — полная цепочка + SMS
const B = crypto.randomUUID() // on_receipt pickup — SMS-ветка самовывоза
const C = crypto.randomUUID() // online неоплаченный — жертва свипа
const D = crypto.randomUUID() // online оплаченный — инвариант «свип не трогает»
const emailRowId = crypto.randomUUID()
const pigeonRowId = crypto.randomUUID()
const smokeIds = [A, B, C, D]

async function seedOrder(id: string, overrides: Partial<typeof orders.$inferInsert>) {
	await db.insert(orders).values({
		id,
		customerName: 'Smoke 10',
		phone: '+7 900 111-22-33',
		fulfillment: 'delivery',
		status: 'created',
		paymentStatus: 'pending',
		paymentMethod: 'on_receipt',
		discountAmount: 0,
		deliveryFee: 19900,
		createdAt: backdated,
		updatedAt: backdated,
		...overrides,
	})
	// createOrder пишет 'created' в events — смоук сеет заказ напрямую, повторяем
	await db.insert(orderStatusEvents).values({ orderId: id, status: 'created' })
}

async function getOrder(id: string) {
	const [row] = await db
		.select({ status: orders.status, paymentStatus: orders.paymentStatus })
		.from(orders)
		.where(eq(orders.id, id))
	return row
}

async function events(orderId: string) {
	const rows = await db
		.select({ status: orderStatusEvents.status })
		.from(orderStatusEvents)
		.where(eq(orderStatusEvents.orderId, orderId))
	return rows.map((r) => r.status)
}

/** SMS-строка заказа (orderId живёт в payload jsonb, отдельной колонки нет) */
async function smsRow(orderId: string) {
	const [row] = await db
		.select()
		.from(notifications)
		.where(sql`${notifications.payload}->>'orderId' = ${orderId}`)
	return row
}

/** Чужие активные заказы — прочь от тика (свежий updatedAt = ещё один интервал ожидания) */
async function shieldForeignOrders() {
	await db
		.update(orders)
		.set({ updatedAt: new Date() })
		.where(and(inArray(orders.status, [...ACTIVE_STATUSES]), notInArray(orders.id, smokeIds)))
}

async function rebackdate(ids: string[]) {
	await db.update(orders).set({ updatedAt: backdated }).where(inArray(orders.id, ids))
}

async function main() {
	await seedOrder(A, {})
	await seedOrder(B, { fulfillment: 'pickup' })
	await seedOrder(C, { paymentMethod: 'online', status: 'created' })
	await seedOrder(D, { paymentMethod: 'online', paymentStatus: 'paid' })
	await db.insert(payments).values({ orderId: C, amount: 100000, status: 'created' })
	await db.insert(payments).values({ orderId: D, amount: 100000, status: 'paid' })
	await db.insert(notifications).values({
		id: emailRowId,
		channel: 'email',
		event: 'order.ready',
		status: 'pending',
		payload: { to: 'smoke10@food.local', subject: 'Smoke 10 email', text: 'Строка шва email' },
	})
	await db.insert(notifications).values({
		id: pigeonRowId,
		channel: 'pigeon',
		event: 'order.ready',
		status: 'pending',
		payload: { to: 'nowhere', text: 'нет такого канала' },
	})

	// --- тикет 01: ядро переходов + SMS при ready ---
	let r = await transitionOrderStatus(A, 'preparing')
	check('01: created→preparing применён', r.data?.status === 'preparing', r)
	check(
		'01: unpaid-online гвард жив',
		(await transitionOrderStatus(C, 'preparing')).error === 'Заказ ожидает оплаты',
	)
	check(
		'01: платную отмену ядро запрещает',
		(await transitionOrderStatus(D, 'cancelled_by_vendor')).error ===
			'Оплаченный заказ отменить нельзя',
	)

	r = await transitionOrderStatus(A, 'ready')
	check('01: preparing→ready применён', r.data?.status === 'ready', r)
	const rowA = await smsRow(A)
	check(
		'01: SMS-строка pending в той же транзакции',
		rowA?.status === 'pending' && rowA.event === 'order.ready',
		rowA,
	)
	check(
		'01: payload SMS корректен',
		rowA?.payload != null &&
			(rowA.payload as { to?: string; text?: string }).to === '+7 900 111-22-33' &&
			(rowA.payload as { text?: string }).text === orderReadySms(A, 'delivery'),
		rowA?.payload,
	)

	// --- тикет 02: флушер ---
	await flushOnce()
	const [smsAfter] = await db.select().from(notifications).where(eq(notifications.id, rowA!.id))
	check('02: SMS-строка → sent', smsAfter.status === 'sent', smsAfter)
	const [emailAfter] = await db.select().from(notifications).where(eq(notifications.id, emailRowId))
	check('02: email-строка → sent', emailAfter.status === 'sent', emailAfter)
	const [pigeonAfter] = await db
		.select()
		.from(notifications)
		.where(eq(notifications.id, pigeonRowId))
	check(
		'02: неизвестный канал → failed с причиной',
		pigeonAfter.status === 'failed' && (pigeonAfter.error ?? '').includes('Нет провайдера'),
		pigeonAfter,
	)
	await flushOnce()
	const [pigeon2] = await db.select().from(notifications).where(eq(notifications.id, pigeonRowId))
	check(
		'02: failed терминален (второй тик не трогает)',
		pigeon2.status === 'failed' && pigeon2.updatedAt.getTime() === pigeonAfter.updatedAt.getTime(),
		pigeon2,
	)

	// Mailpit получил письмо (SMTP_HOST=localhost:1025 в .env)
	try {
		const res = await fetch('http://localhost:8025/api/v1/messages')
		const data = (await res.json()) as {
			messages?: Array<{ Subject?: string; SubjectName?: string }>
		}
		const found = (data.messages ?? []).some(
			(m) => (m.Subject ?? m.SubjectName) === 'Smoke 10 email',
		)
		check('02: письмо доехало до Mailpit', found)
	} catch (error) {
		check('02: письмо доехало до Mailpit', false, error)
	}

	// --- тикет 03: тик автоджобы (свип + продвижение) ---
	await shieldForeignOrders()
	await rebackdate([A, B, D])
	const tick1 = await autoStatusTick()
	check(
		'03: тик свипнул 1 (C) и продвинул 3 (A, B, D)',
		tick1.swept === 1 && tick1.advanced === 3,
		tick1,
	)

	const cAfter = await getOrder(C)
	check('03: свип C → cancelled_by_timeout', cAfter?.status === 'cancelled_by_timeout', cAfter)
	const [cPayment] = await db.select().from(payments).where(eq(payments.orderId, C))
	check('03: payment C → cancelled', cPayment.status === 'cancelled', cPayment)
	check(
		'03: событие cancelled_by_timeout записано',
		(await events(C)).includes('cancelled_by_timeout'),
	)

	const dAfter = await getOrder(D)
	check(
		'03: оплаченный онлайн НЕ свипнут и едет (created→preparing)',
		dAfter?.status === 'preparing' && dAfter.paymentStatus === 'paid',
		dAfter,
	)
	check('03: B создан→готовится', (await getOrder(B))?.status === 'preparing')

	// A: ready→in_delivery→delivered (→paid); B: preparing→ready (SMS pickup)
	await rebackdate([A, B])
	await autoStatusTick()
	const aFinal = await getOrder(A)
	check(
		'03: A дошёл до delivered + paid (сбор on_receipt)',
		aFinal?.status === 'delivered' && aFinal.paymentStatus === 'paid',
		aFinal,
	)
	const rowB = await smsRow(B)
	check(
		'03: SMS-ветка самовывоза',
		rowB != null && (rowB.payload as { text?: string }).text === orderReadySms(B, 'pickup'),
		rowB?.payload,
	)

	await rebackdate([B])
	await autoStatusTick()
	const bFinal = await getOrder(B)
	check(
		'03: B дошёл до picked_up + paid',
		bFinal?.status === 'picked_up' && bFinal.paymentStatus === 'paid',
		bFinal,
	)
	check(
		'03: полная цепочка событий A',
		JSON.stringify(await events(A)) ===
			JSON.stringify(['created', 'preparing', 'ready', 'in_delivery', 'delivered']),
		await events(A),
	)

	// регрессия ядра: терминальный статус без продолжения
	check(
		'01: недопустимый переход из терминала',
		(await transitionOrderStatus(A, 'created')).error === 'Недопустимый переход статуса',
	)

	// --- тикет 03: свип работает при DEMO_AUTO_STATUS=false (prod-режим) ---
	process.env.DEMO_AUTO_STATUS = 'false'
	const E = crypto.randomUUID()
	smokeIds.push(E)
	await seedOrder(E, { paymentMethod: 'on_receipt' }) // backdated при посеве
	await autoStatusTick()
	check(
		'03: флаг off — свип/продвижение не двигают заказы',
		(await getOrder(E))?.status === 'created',
		await getOrder(E),
	)
	process.env.DEMO_AUTO_STATUS = 'true'
	await autoStatusTick()
	check(
		'03: флаг on — заказ оживает',
		(await getOrder(E))?.status === 'preparing',
		await getOrder(E),
	)
}

async function cleanup() {
	await db.delete(payments).where(inArray(payments.orderId, smokeIds))
	await db.delete(orders).where(inArray(orders.id, smokeIds))
	for (const id of smokeIds) {
		await db.delete(notifications).where(sql`${notifications.payload}->>'orderId' = ${id}`)
	}
	await db.delete(notifications).where(inArray(notifications.id, [emailRowId, pigeonRowId]))
}

main()
	.then(async () => {
		await cleanup()
		console.log(
			failures === 0
				? '\nSMOKE OK — все проверки зелёные'
				: `\nSMOKE FAILED — провалов: ${failures}`,
		)
		process.exit(failures === 0 ? 0 : 1)
	})
	.catch(async (error) => {
		console.error('SMOKE CRASHED:', error)
		await cleanup().catch(() => {})
		process.exit(1)
	})
