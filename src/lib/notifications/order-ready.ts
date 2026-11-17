import { shortOrderId } from '@/lib/id'
import type { Fulfillment } from '@/lib/order-timeline'

/**
 * Текст SMS «заказ готов» (этап 10, Q6). Рендерится в момент вставки строки
 * аутбокса — флушер и провайдеры ничего не знают о заказах: payload
 * самодостаточен ({to, text}). Номер — короткий id, как в UI
 * («Заказ № {id.slice(0, 8)}»). Заказа без телефона не бывает
 * (orders.phone NOT NULL), каждый заказ проходит ready ровно один раз.
 */
export function orderReadySms(orderId: string, fulfillment: Fulfillment): string {
	const number = shortOrderId(orderId)
	return fulfillment === 'pickup'
		? `Ваш заказ № ${number} готов к самовывозу`
		: `Ваш заказ № ${number} готов — курьер скоро выедет`
}
