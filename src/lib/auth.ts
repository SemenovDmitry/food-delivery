import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, phoneNumber } from 'better-auth/plugins'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { notifications } from '@/db/schema'
import { sendEmail } from '@/lib/email'
import { tempEmailFor } from '@/lib/temp-email'

/**
 * Демо-SMS: код всегда `DEMO_SMS_OTP_CODE` (по умолчанию 1111, §5.15).
 * better-auth генерирует свой код, но verifyOTP — кастомная проверка,
 * поэтому реальный код никогда не совпадает и в дело не идёт.
 */
const DEMO_SMS_CODE = process.env.DEMO_SMS_OTP_CODE ?? '1111'

export const auth = betterAuth({
	// AUTH_SECRET_BUILD_FALLBACK задаётся ТОЛЬКО в build-стадии Dockerfile
	// (better-auth валидирует секрет при инициализации модуля). В рантайме
	// runner-стадия её не наследует: без настоящего AUTH_SECRET better-auth
	// упадёт с «default secret» — fail-fast (§5.18)
	secret: process.env.AUTH_SECRET ?? process.env.AUTH_SECRET_BUILD_FALLBACK,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema,
	}),
	plugins: [
		phoneNumber({
			otpLength: 4,
			sendOTP: async ({ phoneNumber }) => {
				console.log(`[SMS-заглушка] код ${DEMO_SMS_CODE} → ${phoneNumber}`)
				// строка в аутбокс (direct send, мимо флушера — интерактивный OTP, §5.16)
				await db.insert(notifications).values({
					channel: 'sms',
					event: 'otp.auth',
					payload: { phoneNumber, code: DEMO_SMS_CODE },
					status: 'sent',
				})
			},
			verifyOTP: async ({ code }) => code === DEMO_SMS_CODE,
			signUpOnVerification: {
				// временный email для better-auth; настоящий email привязывает поток
				// /email (этап 3, Q1/Q5) — формат в lib/temp-email.ts
				getTempEmail: (phoneNumber) => tempEmailFor(phoneNumber),
				getTempName: (phoneNumber) => phoneNumber,
			},
		}),
		emailOTP({
			otpLength: 6,
			expiresIn: 600,
			sendVerificationOTP: async ({ email, otp }) => {
				await sendEmail({
					to: email,
					subject: 'Код подтверждения Food Delivery',
					text: `Ваш код: ${otp} (действует 10 минут)`,
					html: `<p>Ваш код подтверждения: <strong>${otp}</strong></p><p>Действует 10 минут.</p>`,
				})
			},
		}),
	],
	user: {
		additionalFields: {
			role: {
				type: 'string',
				defaultValue: 'customer',
				input: false, // роль меняется только из админки (updateUserRole)
			},
		},
	},
	session: {
		cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 минут (§2)
	},
})
