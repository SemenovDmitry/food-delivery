import 'server-only'

import { db } from '@/db'
import type { Promotion } from '@/db/schema'
import { categories } from '@/db/schema'
import { type CartLine, getCartForRead, getCartLines } from '@/lib/cart'
import type { CartLineData, CartPromoData, DeliverySettingsData } from '@/lib/cart-types'
import { formatPrice } from '@/lib/format'
import { getDeliverySettings } from '@/lib/settings'
import { getActivePromotions, getPromotionById } from '@/queries/promotions'

export type CartViewData = {
	lines: CartLineData[]
	activePromo: CartPromoData | null
	availablePromos: CartPromoData[]
	delivery: DeliverySettingsData
}

function toLineData(line: CartLine): CartLineData {
	return {
		productId: line.product.id,
		name: line.product.name,
		emoji: line.product.emoji,
		price: line.product.price,
		qty: line.qty,
		categoryId: line.product.categoryId,
	}
}

function toPromoData(promo: Promotion, categoryNames: Map<number, string>): CartPromoData {
	const parts: string[] = []
	if (promo.categoryId !== null) {
		const name = categoryNames.get(promo.categoryId)
		if (name) parts.push(`только: ${name}`)
	}
	if (promo.minTotal > 0) {
		parts.push(`при заказе от ${formatPrice(promo.minTotal)}`)
	}

	return {
		id: promo.id,
		name: promo.name,
		code: promo.code,
		discountType: promo.discountType,
		discountValue: promo.discountValue,
		categoryId: promo.categoryId,
		minTotal: promo.minTotal,
		conditionLabel: parts.length > 0 ? parts.join(', ') : 'на весь заказ',
	}
}

/**
 * Общая загрузка данных корзины для /cart и /checkout (тикеты 03/05).
 * Состав и цены — из БД (§5.10); безкодовые акции отфильтрованы (Q2).
 */
export async function loadCartViewData(): Promise<CartViewData | null> {
	const cart = await getCartForRead()
	const lines = cart ? await getCartLines(cart.id) : []
	if (!cart || lines.length === 0) return null

	const promoRow = cart.promoId ? await getPromotionById(cart.promoId) : null
	const available = (await getActivePromotions()).filter((promo) => promo.code !== null)
	const categoryRows = await db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
	const categoryNames = new Map(categoryRows.map((row) => [row.id, row.name]))

	return {
		lines: lines.map(toLineData),
		activePromo: promoRow ? toPromoData(promoRow, categoryNames) : null,
		availablePromos: available.map((promo) => toPromoData(promo, categoryNames)),
		delivery: await getDeliverySettings(),
	}
}
