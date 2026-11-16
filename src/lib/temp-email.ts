/**
 * Temp-email, который phoneNumber plugin ставит при регистрации (lib/auth.ts,
 * signUpOnVerification) — до привязки настоящего email (этап 3, Q1/Q5).
 * Единый источник формата: auth.ts использует tempEmailFor, UI — isTempEmail.
 */

export function tempEmailFor(phoneNumber: string): string {
	return `phone-${phoneNumber.replace(/\D/g, '')}@temp.food.local`
}

const TEMP_EMAIL_PATTERN = /^phone-\d+@temp\.food\.local$/

export function isTempEmail(email: string): boolean {
	return TEMP_EMAIL_PATTERN.test(email)
}
