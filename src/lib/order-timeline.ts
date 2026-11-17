import type { OrderStatus } from '@/db/schema'
import { ORDER_STATUSES } from '@/db/schema'

/**
 * Константы жизненного цикла заказа (этап 4) — единый источник для трекера,
 * action'а отмены и карточек главной. Паттерн cart-totals: без server-only.
 * Историю смен статусов пишет order_status_events (пишатели: createOrder,
 * cancelOrder, этап 5, этап 10) — цепочка шагов в UI заменена бейджем
 * (этап 4-бис, 2026-11-16), времена шагов из events пригодятся,
 * если таймлайн вернётся (чекбокс этапа 10).
 */

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
	'cancelled_by_timeout',
]

/** Клиент может отменить, пока кухня не закончила; сервер повторно проверяет в транзакции (Q12) */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ['created', 'preparing']

/** status — text-колонка: кривое значение из БД не роняет UI (ревью S7) */
export function isOrderStatus(value: string): value is OrderStatus {
	return (ORDER_STATUSES as readonly string[]).includes(value)
}

/** Терминальный статус — поллинг трекера замолкает (тело запроса не шлётся) */
export function isTerminalStatus(value: string): boolean {
	return isOrderStatus(value) && TERMINAL_STATUSES.includes(value)
}

/** Тип исполнения заказа: ветка цепочки статусов (GLOSSARY «Fulfillment») */
export type Fulfillment = 'delivery' | 'pickup'

/** fulfillment из text-колонки БД: кривое значение → delivery (дефолт ветки) */
export function fulfillmentOf(value: string): Fulfillment {
	return value === 'pickup' ? 'pickup' : 'delivery'
}

/**
 * Легальные следующие статусы для админ-смены (этап 5, Q3): только вперёд по
 * цепочке своего fulfillment, назад никогда; `cancelled_by_vendor` — из
 * created|preparing|ready. Оплаченные не отменяются (refund — этап 9):
 * гвард paymentStatus живёт в action, карта статусов об оплате не знает.
 * Чистая (client-safe): опции select'а в /admin/orders и серверная валидация.
 */
export function nextStatuses(
	status: OrderStatus,
	fulfillment: Fulfillment,
): readonly OrderStatus[] {
	if (isTerminalStatus(status)) return []
	const vendorCancel: readonly OrderStatus[] = ['cancelled_by_vendor']
	switch (status) {
		case 'created':
			return ['preparing', ...vendorCancel]
		case 'preparing':
			return ['ready', ...vendorCancel]
		case 'ready':
			return fulfillment === 'delivery'
				? ['in_delivery', ...vendorCancel]
				: ['picked_up', ...vendorCancel]
		case 'in_delivery':
			return ['delivered']
		default:
			return []
	}
}
