import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { EmailLinkForm } from '@/components/auth/email-link-form'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSession } from '@/lib/session'
import { isTempEmail } from '@/lib/temp-email'

export const metadata: Metadata = { title: 'Привязка email' }

export default function EmailLinkPage() {
	return (
		<Suspense fallback={<Skeleton className='h-80 w-full rounded-xl' aria-hidden />}>
			<EmailLinkContent />
		</Suspense>
	)
}

/** Гард: без сессии — на вход; email уже верифицирован — делать тут нечего */
async function EmailLinkContent() {
	const session = await getSession()
	if (!session) redirect('/login')
	if (session.user.emailVerified) redirect('/orders')

	// возобновление: настоящий email уже вводился — префиллим (temp не показываем)
	const initialEmail = isTempEmail(session.user.email) ? '' : session.user.email

	return (
		<Card>
			<CardHeader>
				{/* CardTitle — div без asChild: h1 держим сами (один h1 на страницу, §7) */}
				<h1 className='font-heading text-lg leading-snug font-semibold'>Привязка email</h1>
				<CardDescription>
					Письмо со случайным кодом — в Mailpit (демо). Email нужен для уведомлений о заказах.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<EmailLinkForm initialEmail={initialEmail} />
			</CardContent>
		</Card>
	)
}
