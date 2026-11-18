import { describe, expect, it } from 'vitest'
import { computeTotals } from './cart-totals'
import type { CartLineData, CartPromoData } from './cart-types'

/** Канон сидера: 199 ₽, бесплатно от 1 000 ₽ (§4 AGENTS) */
const DELIVERY = { deliveryFee: 19900, freeDeliveryThreshold: 100000 }

const lineData = (price: number, qty: number, categoryId: number): CartLineData => ({
	productId: `p-${price}-${categoryId}`,
	name: 'Товар',
	emoji: '🍕',
	price,
	qty,
	categoryId,
})

const promoData = (overrides: Partial<CartPromoData> = {}): CartPromoData => ({
	id: '00000000-0000-0000-0000-000000000001',
	name: 'Тест-акция',
	code: 'TEST10',
	conditionLabel: '',
	stateReason: null,
	discountType: 'percent',
	discountValue: 20,
	categoryId: null,
	minTotal: 0,
	...overrides,
})

describe('computeTotals — доставка', () => {
	it('ниже порога — 199 ₽', () => {
		const totals = computeTotals([lineData(59000, 1, 1)], null, 'delivery', DELIVERY)
		expect(totals.deliveryCost).toBe(19900)
		expect(totals.deliveryFree).toBe(false)
		expect(totals.total).toBe(78900)
	})

	it('ровно на пороге — бесплатно (сравнение ≥)', () => {
		const totals = computeTotals([lineData(50000, 2, 1)], null, 'delivery', DELIVERY)
		expect(totals.deliveryCost).toBe(0)
		expect(totals.deliveryFree).toBe(true)
	})

	it('порог — от суммы товаров ДО скидки', () => {
		const lines = [lineData(59000, 1, 1), lineData(30000, 2, 2)]
		const promo = promoData({ discountValue: 20, categoryId: 2 })
		const totals = computeTotals(lines, promo, 'delivery', DELIVERY)
		// subtotal 1190 ₽ ≥ 1000 ₽ → доставка бесплатная, несмотря на скидку
		expect(totals.deliveryCost).toBe(0)
		expect(totals.deliveryFree).toBe(true)
	})

	it('самовывоз — всегда 0, даже ниже порога', () => {
		const totals = computeTotals([lineData(59000, 1, 1)], null, 'pickup', DELIVERY)
		expect(totals.deliveryCost).toBe(0)
	})
})

describe('computeTotals — скидка', () => {
	const lines = [lineData(59000, 1, 1), lineData(30000, 2, 2)]

	it('валидное промо — скидка в total', () => {
		const totals = computeTotals(lines, promoData(), 'delivery', DELIVERY)
		expect(totals.subtotal).toBe(119000)
		expect(totals.discountAmount).toBe(23800)
		expect(totals.total).toBe(119000 - 23800)
	})

	it('промо с stateReason (протухло) — в скидку не попадает (C1 ревью этапа 1)', () => {
		const promo = promoData({ stateReason: 'Срок действия промокода истёк' })
		const totals = computeTotals(lines, promo, 'delivery', DELIVERY)
		expect(totals.discountAmount).toBe(0)
		expect(totals.total).toBe(119000)
	})

	it('промо валидно по состоянию, но calcDiscount не применим (minTotal) — 0', () => {
		const promo = promoData({ minTotal: 500000 })
		const totals = computeTotals(lines, promo, 'delivery', DELIVERY)
		expect(totals.discountAmount).toBe(0)
		expect(totals.total).toBe(119000)
	})

	it('скидка не уводит total в минус (fixed = база)', () => {
		const promo = promoData({ discountType: 'fixed', discountValue: 999999 })
		const totals = computeTotals([lineData(59000, 1, 1)], promo, 'pickup', DELIVERY)
		expect(totals.discountAmount).toBe(59000)
		expect(totals.total).toBe(0)
	})
})
