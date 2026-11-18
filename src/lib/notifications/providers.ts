import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

const log = logger.child({ component: 'notifications' })

/**
 * Провайдеры каналов аутбокса (этап 10, Q7) — seam для roadmap-замены на
 * настоящих провайдеров: новый файл + env, без переделки логики (паттерн
 * PaymentProvider этапа 9). Провайдер получает самодостаточный payload строки
 * `notifications` и умеет только «отправить» — бросок исключения означает
 * сбой, флушер пометит строку failed (+error). Фабрика бросает внутри вызова
 * (урок этапа 6: module-level throw валит build).
 */

export type NotificationPayload = Record<string, unknown>

export interface ChannelProvider {
	send: (payload: NotificationPayload) => Promise<void>
}

/** Обязательное поле payload'а; malformed → throw → failed с причиной */
function readString(payload: NotificationPayload, key: string): string {
	const value = payload[key]
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`payload.${key} отсутствует или не строка`)
	}
	return value
}

/** SMS — консоль-заглушка (§5.15), по образцу sendOTP в auth.ts */
const smsProvider: ChannelProvider = {
	send: async (payload) => {
		const to = readString(payload, 'to')
		const text = readString(payload, 'text')
		log.info(`[SMS-заглушка] «${text}» → ${to}`)
	},
}

/** Email — обертка существующего sendEmail: SMTP → Mailpit, без SMTP_HOST — консоль */
const emailProvider: ChannelProvider = {
	send: async (payload) => {
		await sendEmail({
			to: readString(payload, 'to'),
			subject: readString(payload, 'subject'),
			text: readString(payload, 'text'),
			html: typeof payload.html === 'string' ? payload.html : undefined,
		})
	},
}

const PROVIDERS: Record<string, ChannelProvider> = {
	sms: smsProvider,
	email: emailProvider,
}

export function getChannelProvider(channel: string): ChannelProvider {
	const provider = PROVIDERS[channel]
	if (!provider) {
		throw new Error(`Нет провайдера для канала «${channel}»`)
	}
	return provider
}
