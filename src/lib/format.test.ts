import { describe, expect, it } from 'vitest'
import { ORDER_STATUSES } from '@/db/schema'
import { formatDiscount, formatPrice, plural, STATUS_LABELS } from './format'

// formatDate/formatDateTime НЕ тестируются: вывод зависит от таймзоны/локали
// машины — приёмка этих функций была визуальной (этап 1), стабильного
// ожидания без мока Intl нет.

describe('formatPrice — копейки → рубли (GLOSSARY «Копейка»)', () => {
	it('целые рубли без дробной части', () => {
		expect(formatPrice(19900)).toBe('199 ₽')
		expect(formatPrice(0)).toBe('0 ₽')
	})

	it('копейки — запятая, 2 знака', () => {
		expect(formatPrice(1234)).toBe('12,34 ₽')
		expect(formatPrice(19999)).toBe('199,99 ₽')
	})

	it('разряды — неразрывный пробел (ru-RU)', () => {
		expect(formatPrice(123400)).toBe('1\u00A0234 ₽')
	})
})

describe('formatDiscount — подпись выгоды', () => {
	it('percent', () => {
		expect(formatDiscount({ discountType: 'percent', discountValue: 20 })).toBe('−20%')
	})

	it('fixed', () => {
		expect(formatDiscount({ discountType: 'fixed', discountValue: 15000 })).toBe('−150 ₽')
	})
})

describe('plural — русская плюрализация', () => {
	it('1/21/101 — один', () => {
		expect(plural(1, 'товар', 'товара', 'товаров')).toBe('товар')
		expect(plural(21, 'товар', 'товара', 'товаров')).toBe('товар')
	})

	it('2–4 (кроме 12–14) — несколько', () => {
		expect(plural(2, 'товар', 'товара', 'товаров')).toBe('товара')
		expect(plural(4, 'товар', 'товара', 'товаров')).toBe('товара')
		expect(plural(22, 'товар', 'товара', 'товаров')).toBe('товара')
	})

	it('5–20 и 11–14 — много', () => {
		expect(plural(5, 'товар', 'товара', 'товаров')).toBe('товаров')
		expect(plural(11, 'товар', 'товара', 'товаров')).toBe('товаров')
		expect(plural(12, 'товар', 'товара', 'товаров')).toBe('товаров')
		expect(plural(14, 'товар', 'товара', 'товаров')).toBe('товаров')
	})
})

describe('STATUS_LABELS — статус текстом, не только цветом (a11y §7)', () => {
	it('лейбл на каждый статус из ORDER_STATUSES', () => {
		for (const status of ORDER_STATUSES) {
			expect(STATUS_LABELS[status], `нет лейбла для ${status}`).toBeTruthy()
		}
		expect(Object.keys(STATUS_LABELS)).toHaveLength(ORDER_STATUSES.length)
	})
})
