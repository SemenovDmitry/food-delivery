import { and, eq, inArray, lt, lte, ne, or } from 'drizzle-orm'
import { db } from '@/db'
import { orderStatusEvents, orders, payments } from '@/db/schema'
import { shortOrderId } from '@/lib/id'
import { ACTIVE_STATUSES, fulfillmentOf, isOrderStatus, nextStatuses } from '@/lib/order-timeline'
import { transitionOrderStatus } from '@/lib/order-transition'
import { paymentWindowCutoff } from '@/lib/payments/window'

/**
 * Автоджоба статусов (этап 10, Q2/Q4/Q5/Q8): тик раз в DEMO_AUTO_STATUS_INTERVAL
 * (старт — из instrumentation.ts, dev on / prod off — флаг гейтит только
 * продвижение). Тик с reentrancy-флагом, свип ДО продвижения:
 *
 * 1) **Свип — всегда** (dev и prod, корректность а не демо): просроченные
 *    онлайн-заказы (предикат зеркалит TTL-гард webhook-core) → по-заказные
 *    транзакции: cancelled_by_timeout + payment cancelled + событие. Сбой
 *    одного заказа не роняет партию. Ленивые TTL-гарды остаются страховкой.
 * 2) **Продвижение** под DEMO_AUTO_STATUS: по-заказный elapsed (updatedAt
 *    старше интервала → один шаг по карте nextStatuses); неоплаченные online
 *    не продвигаются вовсе (их берёт свип; гвард кухни в ядре — страховка).
 *    Рол vendor-отмены — одиночный, в точке created→preparing, только
 *    on_receipt, вероятность DEMO_AUTO_CANCEL_RATE (≈10% заказов).
 *
 * Все переходы — через ядро transitionOrderStatus: события и SMS-строка
 * «заказ готов» пишутся по построению. Оплаченные не отменяются никогда.
 * Логи — console.log с коротким id (pino — этап 11).
 */

function isAutoStatusEnabled(): boolean {
	const raw = process.env.DEMO_AUTO_STATUS
	return raw === 'true' || raw === '1'
}

function autoStatusIntervalMs(): number {
	const raw = Number(process.env.DEMO_AUTO_STATUS_INTERVAL)
	return Number.isFinite(raw) && raw > 0 ? Math.max(5000, raw) : 60_000
}

function autoCancelRate(): number {
	const raw = Number(process.env.DEMO_AUTO_CANCEL_RATE)
	return Number.isFinite(raw) ? Math.min(1, Math.max(0, raw)) : 0.1
}

/** Свип просрочки окна оплаты — единственный системный писатель cancelled_by_timeout */
async function sweepExpiredOnlineOrders(): Promise<number> {
	const cutoff = paymentWindowCutoff()

	const candidates = await db
		.select({ id: orders.id })
		.from(orders)
		.where(
			and(
				eq(orders.paymentMethod, 'online'),
				eq(orders.paymentStatus, 'pending'),
				inArray(orders.status, [...ACTIVE_STATUSES]),
				lt(orders.createdAt, cutoff),
			),
		)

	let swept = 0
	for (const candidate of candidates) {
		try {
			await db.transaction(async (tx) => {
				// шейп ветки expired webhook-core: conditional UPDATE — между выборкой
				// и транзакцией заказ мог быть оплачен/отменён, тогда БД не трогаем
				const timedOut = await tx
					.update(orders)
					.set({ status: 'cancelled_by_timeout', updatedAt: new Date() })
					.where(
						and(
							eq(orders.id, candidate.id),
							eq(orders.paymentStatus, 'pending'),
							inArray(orders.status, [...ACTIVE_STATUSES]),
						),
					)
					.returning({ id: orders.id })
				if (timedOut.length === 0) return
				await tx
					.update(payments)
					.set({ status: 'cancelled', updatedAt: new Date() })
					.where(eq(payments.orderId, candidate.id))
				await tx
					.insert(orderStatusEvents)
					.values({ orderId: candidate.id, status: 'cancelled_by_timeout' })
			})
			swept += 1
			console.log(`[автоджоба] свип: заказ ${shortOrderId(candidate.id)} → cancelled_by_timeout`)
		} catch (error) {
			console.error(`[автоджоба] свип: заказ ${shortOrderId(candidate.id)} — сбой, пропущен`, error)
		}
	}
	return swept
}

/** Продвижение живых заказов на один шаг (только под DEMO_AUTO_STATUS) */
async function advanceOrders(): Promise<number> {
	const cutoff = new Date(Date.now() - autoStatusIntervalMs())

	// неоплаченные online исключены здесь: их продвижение гвардится ядром, а
	// судьбу решает свип по окну — дёргать ядро ради отказа каждый тик незачем
	const candidates = await db
		.select({
			id: orders.id,
			status: orders.status,
			fulfillment: orders.fulfillment,
			paymentMethod: orders.paymentMethod,
			paymentStatus: orders.paymentStatus,
		})
		.from(orders)
		.where(
			and(
				inArray(orders.status, [...ACTIVE_STATUSES]),
				lte(orders.updatedAt, cutoff),
				// De Morgan: НЕ (online И pending) — тип not(and()) в drizzle | undefined
				or(ne(orders.paymentMethod, 'online'), ne(orders.paymentStatus, 'pending')),
			),
		)

	let advanced = 0
	for (const candidate of candidates) {
		try {
			if (!isOrderStatus(candidate.status)) continue // кривой статус из БД — пропустить
			const fulfillment = fulfillmentOf(candidate.fulfillment)
			const [next] = nextStatuses(candidate.status, fulfillment)
			if (!next) continue // активный статус без продолжения не бывает, но пусть безопасно

			// рол vendor-отмены (Q5): одиночный, в точке created→preparing, только
			// on_receipt (неоплаченные online — епархия свипа, оплаченные гвардит ядро)
			if (
				candidate.status === 'created' &&
				candidate.paymentMethod === 'on_receipt' &&
				candidate.paymentStatus === 'pending' &&
				Math.random() < autoCancelRate()
			) {
				const result = await transitionOrderStatus(candidate.id, 'cancelled_by_vendor')
				if (result.data) {
					advanced += 1
					console.log(
						`[автоджоба] заказ ${shortOrderId(candidate.id)}: демо-отмена заведением (~${Math.round(autoCancelRate() * 100)}%)`,
					)
				}
				continue
			}

			const result = await transitionOrderStatus(candidate.id, next)
			if (result.data) {
				advanced += 1
				console.log(
					`[автоджоба] заказ ${shortOrderId(candidate.id)}: ${candidate.status} → ${next}`,
				)
			} else {
				// гонка/гвард — не ошибка демо: лог и следующий тик
				console.log(`[автоджоба] заказ ${shortOrderId(candidate.id)} не продвинут: ${result.error}`)
			}
		} catch (error) {
			console.error(`[автоджоба] заказ ${shortOrderId(candidate.id)} — сбой, пропущен`, error)
		}
	}
	return advanced
}

/** Один тик: свип всегда, продвижение под флагом; reentrancy — наслоение тиков невозможно */
export async function autoStatusTick(): Promise<{ swept: number; advanced: number }> {
	const g = globalThis as { __foodJobTickRunning?: boolean }
	if (g.__foodJobTickRunning) return { swept: 0, advanced: 0 }
	g.__foodJobTickRunning = true
	try {
		const swept = await sweepExpiredOnlineOrders()
		const advanced = isAutoStatusEnabled() ? await advanceOrders() : 0
		return { swept, advanced }
	} finally {
		g.__foodJobTickRunning = false
	}
}

/** Старт периодического тика; globalThis-гвард — страховка от двойного setInterval */
export function startAutoStatusJob(): void {
	const g = globalThis as { __foodJobStarted?: boolean }
	if (g.__foodJobStarted) return
	g.__foodJobStarted = true
	console.log(
		`[автоджоба] стартовала (тик ${autoStatusIntervalMs()} мс, продвижение: ${isAutoStatusEnabled() ? 'on' : 'off'}, свип: всегда)`,
	)
	setInterval(() => {
		autoStatusTick().catch((error) => console.error('[автоджоба] тик упал', error))
	}, autoStatusIntervalMs()).unref?.()
}
