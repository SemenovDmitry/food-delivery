import type { OrderStatus } from '@/db/schema'
import { ORDER_STATUSES } from '@/db/schema'
import { STATUS_LABELS } from '@/lib/format'

/**
 * Чистая логика таймлайна заказа (этап 4, гриллинг Q1/Q2) — паттерн cart-totals:
 * без server-only, импортируется и RSC, и клиентским OrderTracker.
 */

/** orders.fulfillment — text-колонка, форма доставки определяет ветку таймлайна */
export type Fulfillment = 'delivery' | 'pickup'

export type TimelineStepState = 'done' | 'current' | 'pending'

export type TimelineStep = {
	key: OrderStatus
	label: string
	state: TimelineStepState
}

/** Активные заказы — карточка на главной и «Текущий заказ» /orders (Q10) */
export const ACTIVE_STATUSES: readonly OrderStatus[] = [
	'created',
	'preparing',
	'ready',
	'in_delivery',
]

/** Терминальные: поллинг трекинга останавливается, из активных карточек исчезают */
export const TERMINAL_STATUSES: readonly OrderStatus[] = [
	'delivered',
	'picked_up',
	'cancelled_by_customer',
	'cancelled_by_vendor',
]

/** Клиент может отменить, пока кухня не закончила; сервер повторно проверяет в транзакции (Q12) */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ['created', 'preparing']

/** Цепочки по fulfillment — ветка после «Готов» (GLOSSARY «Статус заказа») */
const TIMELINE_STEPS: Record<Fulfillment, readonly OrderStatus[]> = {
	delivery: ['created', 'preparing', 'ready', 'in_delivery', 'delivered'],
	pickup: ['created', 'preparing', 'ready', 'picked_up'],
}

export function isFulfillment(value: string): value is Fulfillment {
	return value === 'delivery' || value === 'pickup'
}

/** status/fulfillment — text-колонки: кривое значение из БД не роняет UI (ревью S7) */
export function isOrderStatus(value: string): value is OrderStatus {
	return (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Терминальный статус — поллинг трекера замолкает (тело запроса не шлётся) */
export function isTerminalStatus(value: string): boolean {
	return isOrderStatus(value) && TERMINAL_STATUSES.includes(value)
}

/**
 * Шаги таймлайна для текущего статуса: done до текущего, current — он, pending — впереди.
 * Отмены не входят в цепочку ветки (баннер вместо таймлайна рисует трекер), доставленные/
 * выданные — все шаги пройдены. Невалидная пара статус/fulfillment → пустой массив.
 */
export function buildTimeline(status: string, fulfillment: string): TimelineStep[] {
	if (!isOrderStatus(status) || !isFulfillment(fulfillment)) return []

	const steps = TIMELINE_STEPS[fulfillment]
	if (TERMINAL_STATUSES.includes(status)) {
		return steps.map((key) => ({ key, label: STATUS_LABELS[key], state: 'done' }))
	}

	const currentIndex = steps.indexOf(status)
	return steps.map((key, index) => ({
		key,
		label: STATUS_LABELS[key],
		state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
	}))
}
