import type { CartLineData, CartPromoData, DeliverySettingsData } from './cart-types'
import { deliveryFeeFor } from './delivery'
import { calcDiscount } from './promo'

export type CartTotals = {
	subtotal: number
	discountAmount: number
	/** активное промо применимо к текущим строкам (иначе — причина из calcDiscount) */
	discountApplicable: boolean
	deliveryCost: number
	/** порог бесплатной доставки пройден (для подсказки на /cart) */
	deliveryFree: boolean
	total: number
}

/**
 * Клиентский пересчёт тоталов для мгновенной реакции (/cart и /checkout):
 * та же calcDiscount и та же deliveryFeeFor, что и на сервере — расхождений
 * нет по построению. Финальные суммы всегда решает createOrder.
 */
export function computeTotals(
	lines: readonly CartLineData[],
	promo: CartPromoData | null,
	fulfillment: 'delivery' | 'pickup',
	delivery: DeliverySettingsData,
): CartTotals {
	const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)
	const discount = promo ? calcDiscount(lines, promo) : null
	const discountAmount = discount?.applicable ? discount.amount : 0
	const deliveryCost = deliveryFeeFor(fulfillment, subtotal, delivery)

	return {
		subtotal,
		discountAmount,
		discountApplicable: discount?.applicable ?? false,
		deliveryCost,
		deliveryFree: subtotal >= delivery.freeDeliveryThreshold,
		total: subtotal - discountAmount + deliveryCost,
	}
}
