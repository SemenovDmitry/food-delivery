import nodemailer from 'nodemailer'

type SendEmailArgs = {
	to: string
	subject: string
	text: string
	html?: string
}

/**
 * Email-транспорт: SMTP → Mailpit в dev (UI :8025).
 * Без `SMTP_HOST` — консоль-заглушка (§5.15).
 */
export async function sendEmail({ to, subject, text, html }: SendEmailArgs): Promise<void> {
	const host = process.env.SMTP_HOST
	if (!host) {
		console.log(`[Email-заглушка] ${subject} → ${to}\n${text}`)
		return
	}

	const transport = nodemailer.createTransport({
		host,
		port: Number(process.env.SMTP_PORT ?? 1025),
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
