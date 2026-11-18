import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { emailOTP, phoneNumber } from 'better-auth/plugins'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { notifications } from '@/db/schema'
import { sendEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'
import { tempEmailFor } from '@/lib/temp-email'

/**
 * Демо-SMS: код всегда `DEMO_SMS_OTP_CODE` (по умолчанию 1111, §5.15).
 * better-auth генерирует свой код, но verifyOTP — кастомная проверка,
 * поэтому реальный код никогда не совпадает и в дело не идёт.
 */
const DEMO_SMS_CODE = env.DEMO_SMS_OTP_CODE

const log = logger.child({ component: 'auth' })

export const auth = betterAuth({
	// Секрет — из env-схемы (этап 11): strict prod требует AUTH_SECRET, lenient
	// build подставляет AUTH_SECRET_BUILD_FALLBACK (цепочка переехала в lib/env.ts;
	// better-auth валидирует секрет при инициализации модуля — §5.18)
	secret: env.AUTH_SECRET,
	// baseURL — из env-схемы: гасит warn better-auth «Base URL is not set»
	// (dev-фолбэк localhost:3000 в lib/env.ts, prod задаёт compose — §5.32-а)
	baseURL: env.BETTER_AUTH_URL,
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema,
	}),
	plugins: [
		phoneNumber({
			otpLength: 4,
			sendOTP: async ({ phoneNumber }) => {
				log.info(`[SMS-заглушка] код ${DEMO_SMS_CODE} → ${phoneNumber}`)
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
