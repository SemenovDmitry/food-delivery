import { Suspense } from 'react'
import { AdminNav } from '@/components/admin/admin-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { requireAdmin } from '@/lib/session'

export const metadata = { title: 'Админка' }

/**
 * Каркас /admin/* (этап 5, Q2/Q14): живой гвард на КАЖДОМ запросе
 * (роль admin|manager, бан/архив → срез) + навигация по роли.
 * Своей шапки магазина здесь нет — админка рендерится в корневом layout.
 * Все динамические чтения (сессия-гард + страницы) — ПОД <Suspense>
 * (§5.3/prerender-гейт: без границы build падает «blocking route»).
 */
export default function AdminLayout({ children }: LayoutProps<'/admin'>) {
	return (
		<div className='mx-auto w-full max-w-6xl px-4 pb-16'>
			<Suspense fallback={<HeaderSkeleton />}>
				<AdminHeader />
			</Suspense>
			<main id='main-content' className='pt-6'>
				<Suspense fallback={null}>{children}</Suspense>
			</main>
		</div>
	)
}

/** Живой гвард + навигация по роли (manager видит только «Заказы») */
async function AdminHeader() {
	const { role } = await requireAdmin()
	return (
		<header className='flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b py-4'>
			<h1 className='text-lg font-bold'>Админка</h1>
			{/* §5.30: usePathname в клиентском shell — только внутри Suspense */}
			<Suspense fallback={<NavSkeleton />}>
				<AdminNav role={role} />
			</Suspense>
		</header>
	)
}

function HeaderSkeleton() {
	return (
		<div className='flex flex-wrap items-center justify-between gap-3 border-b py-4' aria-hidden>
			<Skeleton className='h-6 w-28 rounded-md' />
		</div>
	)
}

function NavSkeleton() {
	return (
		<div className='flex gap-2' aria-hidden>
			<Skeleton className='h-8 w-24 rounded-md' />
			<Skeleton className='h-8 w-24 rounded-md' />
			<Skeleton className='h-8 w-24 rounded-md' />
		</div>
	)
}
