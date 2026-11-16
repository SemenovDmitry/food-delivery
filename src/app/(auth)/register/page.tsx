import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthPhoneWizard } from '@/components/auth/auth-phone-wizard'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Регистрация' }

export default function RegisterPage() {
	return (
		<Suspense fallback={<Skeleton className='h-80 w-full rounded-xl' aria-hidden />}>
			<RegisterContent />
		</Suspense>
	)
}

/**
 * Гард: сессия без верифицированного email — недоделанная регистрация (Q1/Q5),
 * resume на /email; с верифицированным — на /orders.
 */
async function RegisterContent() {
	const session = await getSession()
	if (session) redirect(session.user.emailVerified ? '/orders' : '/email')

	return (
		<Card>
			<CardHeader>
				{/* CardTitle — div без asChild: h1 держим сами (один h1 на страницу, §7) */}
				<h1 className='font-heading text-lg leading-snug font-semibold'>Создать аккаунт</h1>
				<CardDescription>
					Регистрация по телефону — код придёт в SMS (демо: 1111). Email привяжете после.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<AuthPhoneWizard mode='register' redirectTo='/orders' />
			</CardContent>
		</Card>
	)
}
