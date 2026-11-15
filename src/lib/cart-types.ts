import type { CalcPromo } from '@/lib/promo'

/**
 * Серилизуемые данные корзины для клиентских компонентов /cart и /checkout
 * (сервер → клиент props; состав и цены — из БД, не из клиента, §5.10).
 */

export type CartLineData = {
	productId: string
	name: string
	emoji: string
	price: number
	qty: number
	categoryId: number
}

/** Промо для клиентского пересчёта (calcDiscount) и отображения */
export type CartPromoData = CalcPromo & {
	id: string
	name: string
	code: string | null
	/** «только: Шаурма, при заказе от 1 000 ₽» — собирается на сервере */
	conditionLabel: string
}

export type DeliverySettingsData = {
	deliveryFee: number
	freeDeliveryThreshold: number
}
