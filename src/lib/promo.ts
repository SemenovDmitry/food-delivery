import type { Promotion } from '@/db/schema'
import type { CartLine } from '@/lib/cart'
import { formatPrice } from '@/lib/format'

/**
 * Чистые функции скидки/окна — БЕЗ 'server-only': используются и на сервере
 * (actions, страницы), и в клиенте (optimistic-пересчёт тоталов при смене
 * qty на /cart). Единственный источник правды о скидке (этап 1, гриллинг).
 */

/**
 * Окно действия акции — единая проверка для чтений вне кеша (§5.3):
 * queries/promotions (лента) и actions/orders (ревалидация промокода).
 */
export function isPromoInWindow(promo: Promotion, now: Date): boolean {
	const started = !promo.startsAt || promo.startsAt.getTime() <= now.getTime()
	const notEnded = !promo.endsAt || promo.endsAt.getTime() >= now.getTime()
	return started && notEnded
}

/** Витринный фильтр окна — общий для getActivePromotions (RSC) и GET /api/promotions */
export function filterPromosInWindow(promos: Promotion[], now: Date): Promotion[] {
	return promos.filter((p) => isPromoInWindow(p, now))
}

/**
 * Валидность акции ПО СОСТОЯНИЮ (не зависит от состава корзины): isActive + окно.
 * null = применима; строка = причина отказа. Показ активного промо на /cart и
 * /checkout (ревью этапа 1, C1: раньше окно/isActive проверялись только в createOrder);
 * createOrder при оформлении проверяет то же самое (§5.10).
 */
export function promoStateReason(promo: Promotion | null, now: Date): string | null {
	if (!promo?.isActive) return 'Промокод больше не действует'
	if (!isPromoInWindow(promo, now)) return 'Срок действия промокода истёк'
	return null
}

/** Структурный минимум строки для расчёта — совместим с БД-строками и клиентскими данными */
export type CalcLine = { price: number; qty: number; categoryId: number }

/** Промо-минимум для расчёта (Pick из Promotion — клиентские данные совместимы) */
export type CalcPromo = Pick<
	Promotion,
	'discountType' | 'discountValue' | 'categoryId' | 'minTotal'
>

/** Серверные строки корзины (CartLine) → структурный минимум */
export function toCalcLines(lines: CartLine[]): CalcLine[] {
	return lines.map((line) => ({
		price: line.product.price,
		qty: line.qty,
		categoryId: line.product.categoryId,
	}))
}

export type DiscountResult =
	| { applicable: true; amount: number }
	| { applicable: false; reason: string }

/**
 * Единый расчёт скидки (этап 1, гриллинг 2026-11-15): applyPromoCode,
 * страницы корзины и createOrder считают одной функцией — расхождений
 * UI и чекаута нет по построению.
 *
 * База: categoryId = null → вся корзина; иначе Σ(цена × qty) строк только
 * этой категории. percent → floor(база × value / 100); fixed → min(value, база)
 * (скидка не уводит базу в минус). minTotal сравнивается с полной суммой
 * товаров корзины (без доставки и скидки).
 */
export function calcDiscount(lines: readonly CalcLine[], promo: CalcPromo): DiscountResult {
	const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0)

	if (promo.minTotal > 0 && subtotal < promo.minTotal) {
		return { applicable: false, reason: `Нужен заказ от ${formatPrice(promo.minTotal)}` }
	}

	const base =
		promo.categoryId === null
			? subtotal
			: lines
					.filter((line) => line.categoryId === promo.categoryId)
					.reduce((sum, line) => sum + line.price * line.qty, 0)

	if (base === 0) {
		return { applicable: false, reason: 'В корзине нет товаров из акции' }
	}

	const amount =
		promo.discountType === 'percent'
			? Math.floor((base * promo.discountValue) / 100)
			: Math.min(promo.discountValue, base)

	return { applicable: true, amount }
}
