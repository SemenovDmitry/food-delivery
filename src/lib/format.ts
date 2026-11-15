import type { OrderStatus } from '@/db/schema'

/** Копейки → рубли (GLOSSARY «Копейка»: вывод только через formatPrice) */
export function formatPrice(kopecks: number): string {
	const rubles = kopecks / 100
	const hasKopecks = rubles % 1 !== 0
	const formatted = rubles.toLocaleString('ru-RU', {
		minimumFractionDigits: hasKopecks ? 2 : 0,
		maximumFractionDigits: 2,
	})
	return `${formatted} ₽`
}

/** «−20%» | «−150 ₽» — подпись выгоды акции */
export function formatDiscount(promo: { discountType: string; discountValue: number }): string {
	return promo.discountType === 'percent'
		? `−${promo.discountValue}%`
		: `−${formatPrice(promo.discountValue)}`
}

export function formatDate(date: Date | string): string {
	return new Date(date).toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

export function formatDateTime(date: Date | string): string {
	return new Date(date).toLocaleString('ru-RU', {
		day: 'numeric',
		month: 'long',
		hour: '2-digit',
		minute: '2-digit',
	})
}

/** Русская плюрализация: plural(3, 'товар', 'товара', 'товаров') → «товара» */
export function plural(n: number, one: string, few: string, many: string): string {
	const mod10 = n % 10
	const mod100 = n % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}

/** Статус — текстом, не только цветом (a11y-чек-лист) */
export const STATUS_LABELS: Record<OrderStatus, string> = {
	created: 'Создан',
	preparing: 'Готовится',
	ready: 'Готов',
	in_delivery: 'В доставке',
	delivered: 'Доставлен',
	picked_up: 'Выдан',
	cancelled_by_customer: 'Отменён клиентом',
	cancelled_by_vendor: 'Отменён заведением (не принят)',
}
