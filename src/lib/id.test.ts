import { describe, expect, it } from 'vitest'
import { isUuid, shortOrderId } from './id'

describe('isUuid — гард до запроса в БД (§5.24)', () => {
	const valid = '123e4567-e89b-12d3-a456-426614174000'

	it('валидный uuid', () => {
		expect(isUuid(valid)).toBe(true)
	})

	it('регистр не важен (regex /i)', () => {
		expect(isUuid(valid.toUpperCase())).toBe(true)
	})

	it('мусор/обрезанный/лишний символ → false', () => {
		expect(isUuid('')).toBe(false)
		expect(isUuid('xyz')).toBe(false)
		expect(isUuid('123e4567-e89b-12d3-a456-42661417400')).toBe(false)
		expect(isUuid(`${valid}0`)).toBe(false)
	})
})

describe('shortOrderId — «Заказ № …» в UI/логах/SMS', () => {
	it('первые 8 символов', () => {
		expect(shortOrderId('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567')
	})
})
