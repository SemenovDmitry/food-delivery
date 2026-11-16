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
