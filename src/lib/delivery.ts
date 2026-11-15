/**
 * Правила доставки (гриллинг этапа 1, Q17–Q18) — чистая функция БЕЗ 'server-only':
 * используется и в createOrder (истина), и в клиентском preview (computeTotals).
 */

/** Способ исполнения заказа — доменный термин (GLOSSARY «Fulfillment») */
export type Fulfillment = 'delivery' | 'pickup'

export type DeliverySettings = {
	deliveryFee: number
	freeDeliveryThreshold: number
}

/** Бесплатная от порога (порог — от суммы товаров ДО скидки), самовывоз всегда 0 */
export function deliveryFeeFor(
	fulfillment: Fulfillment,
	subtotal: number,
	settings: DeliverySettings,
): number {
	return fulfillment === 'delivery' && subtotal < settings.freeDeliveryThreshold
		? settings.deliveryFee
		: 0
}
