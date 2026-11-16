import { z } from 'zod'
import { normalizeRuPhone } from '@/lib/phone'

/**
 * Схемы форм auth (этап 3) — единый источник правил валидации:
 * тип формы = z.infer, клиент — zodResolver, сервер — safeParse в actions
 * (конвенция CheckoutForm, lib/schemas/checkout.ts).
 */

/** Телефон: нормализуется в канон `+7 XXX XXX-XX-XX`, не прошедший → ошибка формата */
export const authPhoneSchema = z
	.string()
	.trim()
	.max(20, 'Телефон слишком длинный')
	// normalizeRuPhone возвращает null на некорректном вводе — '' триггерит refine
	.transform((value) => normalizeRuPhone(value) ?? '')
	.refine((value) => value.length > 0, 'Введите номер в формате +7 999 000-00-01')

export const smsCodeSchema = z
	.string()
	.trim()
	.regex(/^\d{4}$/, 'Код из SMS — 4 цифры')

export const emailCodeSchema = z
	.string()
	.trim()
	.regex(/^\d{6}$/, 'Код из письма — 6 цифр')

/** Email для привязки: trim + lowercase до проверки (better-auth хранит lowercase) */
export const linkEmailSchema = z
	.string()
	.trim()
	.toLowerCase()
	.max(254, 'Email слишком длинный')
	.pipe(z.email('Введите корректный email'))

export const authPhoneFormSchema = z.object({ phone: authPhoneSchema })
export const smsCodeFormSchema = z.object({ code: smsCodeSchema })
export const linkEmailFormSchema = z.object({ email: linkEmailSchema })
export const emailCodeFormSchema = z.object({ code: emailCodeSchema })

export type AuthPhoneFormValues = z.infer<typeof authPhoneFormSchema>
export type SmsCodeFormValues = z.infer<typeof smsCodeFormSchema>
export type LinkEmailFormValues = z.infer<typeof linkEmailFormSchema>
export type EmailCodeFormValues = z.infer<typeof emailCodeFormSchema>
