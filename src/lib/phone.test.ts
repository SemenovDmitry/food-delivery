import { describe, expect, it } from 'vitest'
import { normalizeRuPhone } from './phone'

describe('normalizeRuPhone — канон «+7 XXX XXX-XX-XX» (этап 3)', () => {
	it('8-ка → +7', () => {
		expect(normalizeRuPhone('89990000003')).toBe('+7 999 000-00-03')
	})

	it('+7 уже с плюсом', () => {
		expect(normalizeRuPhone('+79990000003')).toBe('+7 999 000-00-03')
	})

	it('10 цифр без кода страны → префикс 7', () => {
		expect(normalizeRuPhone('9990000003')).toBe('+7 999 000-00-03')
	})

	it('уже нормализованный — идемпотентен', () => {
		expect(normalizeRuPhone('+7 999 000-00-03')).toBe('+7 999 000-00-03')
	})

	it('мусорные символы вычищаются (ввод из формы)', () => {
		expect(normalizeRuPhone('8 (999) 000-00-03')).toBe('+7 999 000-00-03')
	})

	it('мусор без цифр → null', () => {
		expect(normalizeRuPhone('abc')).toBeNull()
		expect(normalizeRuPhone('')).toBeNull()
	})

	it('11 цифр не с 7/8 → null', () => {
		expect(normalizeRuPhone('39990000000')).toBeNull()
	})

	it('короткий/длинный ввод → null', () => {
		expect(normalizeRuPhone('12345')).toBeNull()
		expect(normalizeRuPhone('899900000031')).toBeNull()
	})
})
