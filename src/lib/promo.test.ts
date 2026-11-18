import { describe, expect, it } from 'vitest'
import type { Promotion } from '@/db/schema'
import type { CartLine } from '@/lib/cart'
import {
	type CalcLine,
	type CalcPromo,
	calcDiscount,
	filterPromosInWindow,
	isPromoInWindow,
	promoStateReason,
	toCalcLines,
} from './promo'

/** Полная фикстура строки promotions (schema.ts) — проверки окна/состояния */
function makePromo(overrides: Partial<Promotion> = {}): Promotion {
	return {
		id: '00000000-0000-0000-0000-000000000001',
		name: 'Тест-акция',
		code: 'TEST10',
		discountType: 'percent',
		discountValue: 10,
		categoryId: null,
		minTotal: 0,
		startsAt: null,
		endsAt: null,
		isActive: true,
		isPublic: true,
		createdAt: new Date('2026-01-01T00:00:00Z'),
		...overrides,
	}
}

/** Промо-минимум для calcDiscount (CalcPromo = Pick из Promotion) */
function makeCalcPromo(overrides: Partial<CalcPromo> = {}): CalcPromo {
	return {
		discountType: 'percent',
		discountValue: 10,
		categoryId: null,
		minTotal: 0,
		...overrides,
	}
}

/** Строка расчёта (CalcLine) */
const line = (price: number, qty: number, categoryId: number): CalcLine => ({
	price,
	qty,
	categoryId,
})

describe('calcDiscount', () => {
	it('percent — floor от базы (скидка не дробит копейки вверх)', () => {
		const result = calcDiscount([line(68000, 1, 1)], makeCalcPromo({ discountValue: 20 }))
		expect(result).toEqual({ applicable: true, amount: 13600 })
	})

	it('percent — дробная база округляется вниз', () => {
		const result = calcDiscount([line(9999, 1, 1)], makeCalcPromo({ discountValue: 33 }))
		// floor(9999 × 33 / 100) = floor(3299.67) = 3299
		expect(result).toEqual({ applicable: true, amount: 3299 })
	})

	it('fixed — не уводит базу в минус (min(value, base))', () => {
		const result = calcDiscount(
			[line(10000, 1, 1)],
			makeCalcPromo({ discountType: 'fixed', discountValue: 15000 }),
		)
		expect(result).toEqual({ applicable: true, amount: 10000 })
	})

	it('fixed — снимает ровно значение, когда база больше', () => {
		const result = calcDiscount(
			[line(60000, 1, 1)],
			makeCalcPromo({ discountType: 'fixed', discountValue: 15000 }),
		)
		expect(result).toEqual({ applicable: true, amount: 15000 })
	})

	it('скоуп по категории — база только из строк категории', () => {
		const lines = [line(59000, 1, 1), line(30000, 2, 2)]
		const result = calcDiscount(lines, makeCalcPromo({ discountValue: 20, categoryId: 2 }))
		// 20% от 600 ₽ шаурмы = 120 ₽, не от полной корзины 1190 ₽
		expect(result).toEqual({ applicable: true, amount: 12000 })
	})

	it('minTotal сравнивается с полной суммой корзины, база — со скоупом', () => {
		const lines = [line(90000, 1, 1), line(30000, 1, 2)]
		const result = calcDiscount(
			lines,
			makeCalcPromo({ discountValue: 20, categoryId: 2, minTotal: 100000 }),
		)
		// порог 1000 ₽ прошёл по полной сумме 1200 ₽, скидка — 20% от 300 ₽
		expect(result).toEqual({ applicable: true, amount: 6000 })
	})

	it('minTotal не достигнут — причина с ценой порога', () => {
		const result = calcDiscount(
			[line(90000, 1, 1)],
			makeCalcPromo({ categoryId: 2, minTotal: 100000 }),
		)
		expect(result).toEqual({ applicable: false, reason: `Нужен заказ от 1\u00A0000 ₽` })
	})

	it('в корзине нет товаров из скоупа — причина', () => {
		const result = calcDiscount([line(59000, 1, 1)], makeCalcPromo({ categoryId: 2 }))
		expect(result).toEqual({ applicable: false, reason: 'В корзине нет товаров из акции' })
	})

	it('пустая корзина — та же причина', () => {
		const result = calcDiscount([], makeCalcPromo())
		expect(result).toEqual({ applicable: false, reason: 'В корзине нет товаров из акции' })
	})
})

describe('isPromoInWindow', () => {
	const now = new Date('2026-11-18T12:00:00Z')

	it('без окна — всегда применима', () => {
		expect(isPromoInWindow(makePromo(), now)).toBe(true)
	})

	it('внутри окна', () => {
		expect(
			isPromoInWindow(
				makePromo({
					startsAt: new Date('2026-11-01T00:00:00Z'),
					endsAt: new Date('2026-12-01T00:00:00Z'),
				}),
				now,
			),
		).toBe(true)
	})

	it('до начала и после конца — нет', () => {
		expect(isPromoInWindow(makePromo({ startsAt: new Date('2026-12-01T00:00:00Z') }), now)).toBe(
			false,
		)
		expect(isPromoInWindow(makePromo({ endsAt: new Date('2026-11-01T00:00:00Z') }), now)).toBe(
			false,
		)
	})

	it('границы окна включительно', () => {
		const startsAt = new Date('2026-11-18T12:00:00Z')
		const endsAt = new Date('2026-11-18T12:00:00Z')
		expect(isPromoInWindow(makePromo({ startsAt }), now)).toBe(true)
		expect(isPromoInWindow(makePromo({ endsAt }), now)).toBe(true)
	})
})

describe('promoStateReason', () => {
	it('isActive=false первичен — даже при плохом окне', () => {
		const promo = makePromo({ isActive: false, endsAt: new Date('2020-01-01T00:00:00Z') })
		expect(promoStateReason(promo, new Date())).toBe('Промокод больше не действует')
	})

	it('окно истекло', () => {
		const promo = makePromo({ endsAt: new Date('2020-01-01T00:00:00Z') })
		expect(promoStateReason(promo, new Date())).toBe('Срок действия промокода истёк')
	})

	it('валидное состояние — null', () => {
		expect(promoStateReason(makePromo(), new Date())).toBeNull()
	})
})

describe('filterPromosInWindow', () => {
	it('оставляет только акции в окне', () => {
		const now = new Date('2026-11-18T12:00:00Z')
		const valid = makePromo()
		const expired = makePromo({
			id: '00000000-0000-0000-0000-000000000002',
			endsAt: new Date('2020-01-01T00:00:00Z'),
		})
		const future = makePromo({
			id: '00000000-0000-0000-0000-000000000003',
			startsAt: new Date('2027-01-01T00:00:00Z'),
		})
		expect(filterPromosInWindow([valid, expired, future], now)).toEqual([valid])
	})
})

describe('toCalcLines', () => {
	it('маппит серверные строки корзины в структурный минимум', () => {
		const lines = [
			{ product: { price: 59000, categoryId: 1 }, qty: 1 },
			{ product: { price: 30000, categoryId: 2 }, qty: 2 },
		] as CartLine[]
		expect(toCalcLines(lines)).toEqual([
			{ price: 59000, qty: 1, categoryId: 1 },
			{ price: 30000, qty: 2, categoryId: 2 },
		])
	})
})
