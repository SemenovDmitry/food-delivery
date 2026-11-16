import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { AuthPhoneWizard } from '@/components/auth/auth-phone-wizard'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Вход' }

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
	return (
		<Suspense fallback={<Skeleton className='h-80 w-full rounded-xl' aria-hidden />}>
			<LoginContent searchParams={searchParams} />
		</Suspense>
	)
}

/** Гард (сессия → уходим) и redirect-параметр — в некешируемом скоупе (§5.3) */
async function LoginContent({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
	const [session, params] = await Promise.all([getSession(), searchParams])
	if (session) redirect(safeRedirectPath(params.redirect))

	return (
		<Card>
			<CardHeader>
				{/* CardTitle — div без asChild: h1 держим сами (один h1 на страницу, §7) */}
				<h1 className='font-heading text-lg leading-snug font-semibold'>Вход</h1>
				<CardDescription>Вход по телефону — код придёт в SMS (демо: 1111)</CardDescription>
			</CardHeader>
			<CardContent>
				<AuthPhoneWizard mode='login' redirectTo={safeRedirectPath(params.redirect)} />
			</CardContent>
		</Card>
	)
}
