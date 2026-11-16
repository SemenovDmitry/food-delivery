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

/** Причины принудительного среза сессии (этап 5, Q14) — banner на форме входа */
const NOTICES: Record<string, string> = {
	banned: 'Аккаунт заблокирован',
	deleted: 'Аккаунт удалён',
	role: 'Права доступа изменились — войдите заново',
}

/** Гард (сессия → уходим) и redirect-параметр — в некешируемом скоупе (§5.3) */
async function LoginContent({
	searchParams,
}: {
	searchParams: Promise<{ redirect?: string; notice?: string }>
}) {
	const [session, params] = await Promise.all([getSession(), searchParams])
	const notice = params.notice ? NOTICES[params.notice] : undefined
	// после среза гардом сессия может оставаться живой (из RSC cookie не мутировать,
	// см. cutAccess) — явный notice важнее автоперенаправления
	if (session && !notice) redirect(safeRedirectPath(params.redirect))

	return (
		<Card>
			<CardHeader>
				{/* CardTitle — div без asChild: h1 держим сами (один h1 на страницу, §7) */}
				<h1 className='font-heading text-lg leading-snug font-semibold'>Вход</h1>
				<CardDescription>Вход по телефону — код придёт в SMS (демо: 1111)</CardDescription>
			</CardHeader>
			<CardContent>
				{notice ? (
					<p
						role='alert'
						className='mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm'
					>
						{notice}
					</p>
				) : null}
				<AuthPhoneWizard mode='login' redirectTo={safeRedirectPath(params.redirect)} />
			</CardContent>
		</Card>
	)
}
