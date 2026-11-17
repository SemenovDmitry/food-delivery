'use client'

import { cn } from 'cn'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Разделы админки (этап 5 + чат этапа 6): manager видит «Заказы» и «Чаты» (Q2/Q6), остальное — admin */
const LINKS: { href: string; label: string; adminOnly: boolean }[] = [
	{ href: '/admin/orders', label: 'Заказы', adminOnly: false },
	{ href: '/admin/chats', label: 'Чаты', adminOnly: false },
	{ href: '/admin/products', label: 'Товары', adminOnly: true },
	{ href: '/admin/categories', label: 'Категории', adminOnly: true },
	{ href: '/admin/promotions', label: 'Акции', adminOnly: true },
	{ href: '/admin/users', label: 'Пользователи', adminOnly: true },
	{ href: '/admin/settings', label: 'Настройки', adminOnly: true },
]

/**
 * Клиентская навигация с активным пунктом (usePathname). §5.30: usePathname в
 * клиентском shell под cacheComponents роняет пререндер — компонент обязан
 * жить в <Suspense> (layout оборачивает).
 */
export function AdminNav({ role }: { role: 'admin' | 'manager' }) {
	const pathname = usePathname()
	const links = LINKS.filter((link) => role === 'admin' || !link.adminOnly)

	return (
		<nav aria-label='Разделы админки' className='flex flex-wrap gap-1'>
			{links.map((link) => {
				const active = pathname === link.href || pathname.startsWith(`${link.href}/`)
				return (
					<Link
						key={link.href}
						href={link.href}
						aria-current={active ? 'page' : undefined}
						className={cn(
							'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
							active
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-muted hover:text-foreground',
						)}
					>
						{link.label}
					</Link>
				)
			})}
		</nav>
	)
}
