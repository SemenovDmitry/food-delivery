import nodemailer from 'nodemailer'
import { env } from '@/lib/env'
import { logger } from '@/lib/logger'

const log = logger.child({ component: 'email' })

type SendEmailArgs = {
	to: string
	subject: string
	text: string
	html?: string
}

/**
 * Email-транспорт: SMTP → Mailpit в dev (UI :8025).
 * Без `SMTP_HOST` (пусто/не задано — env-схема даёт undefined) — консоль-заглушка (§5.15).
 */
export async function sendEmail({ to, subject, text, html }: SendEmailArgs): Promise<void> {
	const host = env.SMTP_HOST
	if (!host) {
		log.info(`[Email-заглушка] ${subject} → ${to}\n${text}`)
		return
	}

	const transport = nodemailer.createTransport({
		host,
		port: env.SMTP_PORT ?? 1025,
		secure: false,
	})

	await transport.sendMail({
		from: 'Food Delivery <no-reply@food.local>',
		to,
		subject,
		text,
		html,
	})
}
