/**
 * Мок server actions заказа/промо для Storybook (этап 13, слайс 2):
 * промо применяется всегда (subtotal фикстур проходим), заказ создаётся.
 * Сигнатуры — typeof прод-модуля (tsc ловит расхождение).
 */
import type * as OrderActions from '@/lib/actions/orders'

export const applyPromoCode: typeof OrderActions.applyPromoCode = async (code) => ({
	data: { name: `Мок-акция ${code}` },
	error: null,
})

export const removePromoCode: typeof OrderActions.removePromoCode = async () => ({
	data: { removed: true },
	error: null,
})

export const createOrder: typeof OrderActions.createOrder = async () => ({
	data: { orderId: '99999999-9999-9999-9999-999999999999', payUrl: null },
	error: null,
})

export const cancelOrder: typeof OrderActions.cancelOrder = async () => ({
	data: { cancelled: true },
	error: null,
})

export const updateOrderStatus: typeof OrderActions.updateOrderStatus = async (
	_orderId,
	status,
) => ({
	data: { status },
	error: null,
})
