'use client'

import { ShoppingBag } from 'lucide-react'
import Link from 'next/link'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { authClient } from '@/lib/auth-client'

type HeaderProps = {
	/** Suspense-слот бейджa корзины (CartBadge) — рендерится сервером в layout (тикет 07) */
	cartSlot: React.ReactNode
}

/**
 * Клиентский header (§11): навигация + GET-форма поиска `?q` (перенесена с главной
 * 2026-11-15) + бейдж корзины (динамический Suspense-слот, shell кешируемый) +
 * ThemeToggle + AuthArea на authClient.useSession().
 */
export function Header({ cartSlot }: HeaderProps) {
	const { data: session, isPending } = authClient.useSession()

	return (
		<header className='sticky top-0 z-40 border-b bg-background/80 backdrop-blur'>
			<div className='mx-auto flex h-14 max-w-6xl items-center gap-4 px-4'>
				<Link href='/' className='text-lg font-bold'>
					<span aria-hidden>🌯</span> Food Delivery
				</Link>

				<nav aria-label='Основная навигация' className='hidden items-center gap-1 sm:flex'>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/'>Меню</Link>
					</Button>
					<Button variant='ghost' size='sm' asChild>
						<Link href='/promo'>Акции</Link>
					</Button>
				</nav>

				{/*
          Нативная GET-форма поиска: работает с любой страницы, сабмит → /?q=…
          (§5.3: searchParams не читаем в клиентском shell — shell остаётся кешируемым,
          поэтому без defaultValue).
        */}
				<search className='min-w-0 flex-1'>
					<form action='/' method='get' className='flex w-full items-center justify-end gap-1'>
						<Input
							type='search'
							name='q'
							aria-label='Поиск по меню'
							placeholder='Найти в меню…'
							className='h-9 max-w-xs'
						/>
						<Button type='submit' variant='ghost' size='sm'>
							Найти
						</Button>
					</form>
				</search>

				<div className='ml-auto flex items-center gap-2'>
					<Button variant='ghost' size='sm' asChild className='relative'>
						<Link href='/cart'>
							<ShoppingBag aria-hidden className='size-4' />
							{cartSlot}
						</Link>
					</Button>
					<ThemeToggle />
					{isPending ? (
						<div className='h-9 w-20 animate-pulse rounded-md bg-muted' aria-hidden />
					) : session ? (
						<div className='flex items-center gap-2'>
							<span className='text-sm text-muted-foreground'>{session.user.name}</span>
							<Button variant='outline' size='sm' onClick={() => authClient.signOut()}>
								Выйти
							</Button>
						</div>
					) : (
						<Button variant='outline' size='sm' asChild>
							<Link href='/login'>Войти</Link>
						</Button>
					)}
				</div>
			</div>
		</header>
	)
}
