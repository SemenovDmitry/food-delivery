import { describe, expect, it } from 'vitest'
import {
	ACTIVE_STATUSES,
	CANCELLABLE_STATUSES,
	fulfillmentOf,
	isOrderStatus,
	isTerminalStatus,
	nextStatuses,
	TERMINAL_STATUSES,
} from './order-timeline'

describe('константы жизненного цикла', () => {
	it('ACTIVE — до терминала', () => {
		expect(ACTIVE_STATUSES).toEqual(['created', 'preparing', 'ready', 'in_delivery'])
	})

	it('TERMINAL — все 5 исходов (вкл. cancelled_by_timeout этапа 9)', () => {
		expect(TERMINAL_STATUSES).toEqual([
			'delivered',
			'picked_up',
			'cancelled_by_customer',
			'cancelled_by_vendor',
			'cancelled_by_timeout',
		])
	})

	it('CANCELLABLE — пока кухня не закончила', () => {
		expect(CANCELLABLE_STATUSES).toEqual(['created', 'preparing'])
	})
})

describe('isOrderStatus / isTerminalStatus', () => {
	it('валидные статусы проходят, кривое значение из БД — нет (ревью S7)', () => {
		expect(isOrderStatus('ready')).toBe(true)
		expect(isOrderStatus('cancelled_by_timeout')).toBe(true)
		expect(isOrderStatus('несуществующий')).toBe(false)
		expect(isOrderStatus('')).toBe(false)
	})

	it('терминальный — поллинг замолкает', () => {
		expect(isTerminalStatus('delivered')).toBe(true)
		expect(isTerminalStatus('cancelled_by_timeout')).toBe(true)
		expect(isTerminalStatus('created')).toBe(false)
		expect(isTerminalStatus('несуществующий')).toBe(false)
	})
})

describe('fulfillmentOf', () => {
	it('ветка по значению, кривое значение → delivery (дефолт)', () => {
		expect(fulfillmentOf('pickup')).toBe('pickup')
		expect(fulfillmentOf('delivery')).toBe('delivery')
		expect(fulfillmentOf('мусор')).toBe('delivery')
	})
})

describe('nextStatuses — карта админ-переходов (этап 5, Q3)', () => {
	it('created → preparing | отменён заведением', () => {
		expect(nextStatuses('created', 'delivery')).toEqual(['preparing', 'cancelled_by_vendor'])
		expect(nextStatuses('created', 'pickup')).toEqual(['preparing', 'cancelled_by_vendor'])
	})

	it('preparing → ready | отменён заведением', () => {
		expect(nextStatuses('preparing', 'delivery')).toEqual(['ready', 'cancelled_by_vendor'])
	})

	it('ready ветвится по fulfillment', () => {
		expect(nextStatuses('ready', 'delivery')).toEqual(['in_delivery', 'cancelled_by_vendor'])
		expect(nextStatuses('ready', 'pickup')).toEqual(['picked_up', 'cancelled_by_vendor'])
	})

	it('in_delivery → delivered (без отмены)', () => {
		expect(nextStatuses('in_delivery', 'delivery')).toEqual(['delivered'])
	})

	it('терминальные — вперёд некуда', () => {
		expect(nextStatuses('delivered', 'delivery')).toEqual([])
		expect(nextStatuses('picked_up', 'pickup')).toEqual([])
		expect(nextStatuses('cancelled_by_customer', 'delivery')).toEqual([])
		expect(nextStatuses('cancelled_by_vendor', 'delivery')).toEqual([])
		expect(nextStatuses('cancelled_by_timeout', 'delivery')).toEqual([])
	})
})
