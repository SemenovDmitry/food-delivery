import { cn } from 'cn'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { OrderStatus } from '@/db/schema'
import { formatDate, formatPrice, STATUS_LABELS } from '@/lib/format'
import { getSession } from '@/lib/session'
import type { UserOrder } from '@/queries/orders'
import { getUserOrders } from '@/queries/orders'

export const metadata: Metadata = { title: 'Мои заказы' }

/** Нетерминальные статусы — «текущий заказ» (схема: 8 статусов, §2) */
const ACTIVE_STATUSES: readonly OrderStatus[] = ['created', 'preparing', 'ready', 'in_delivery']

export default function OrdersPage() {
	return (
		<main id='main-content' className='mx-auto max-w-3xl px-4 pb-16'>
			<Suspense fallback={<OrdersSkeleton />}>
				<OrdersContent />
			</Suspense>
		</main>
	)
}

/** Гард по сессии (§8: закрытая зона пользователя) — в некешируемом скоупе (§5.3) */
async function OrdersContent() {
	const session = await getSession()
	if (!session) redirect('/login')

	const allOrders = await getUserOrders(session.user.id)
	const current = allOrders.find((entry) =>
		ACTIVE_STATUSES.includes(entry.order.status as OrderStatus),
	)
	const history = current ? allOrders.filter((entry) => entry !== current) : allOrders

	return (
		<div className='space-y-6 pt-6'>
			<h1 className='text-2xl font-bold'>Мои заказы</h1>

			{!session.user.emailVerified && <EmailBanner />}

			{allOrders.length === 0 ? (
				<Card>
					<CardContent className='flex flex-col items-center gap-3 py-10 text-center'>
						<p aria-hidden className='text-4xl'>
							🧾
						</p>
						<p className='text-sm text-muted-foreground'>Заказов пока нет</p>
						<Button size='sm' asChild>
							<Link href='/'>Перейти в меню</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<>
					{current && (
						<section aria-labelledby='current-order-heading' className='space-y-3'>
							<h2 id='current-order-heading' className='text-base font-semibold'>
								Текущий заказ
							</h2>
							<OrderCard entry={current} current />
						</section>
					)}
					{history.length > 0 && (
						<section aria-labelledby='history-heading' className='space-y-3'>
							<h2 id='history-heading' className='text-base font-semibold'>
								История
							</h2>
							<div className='space-y-3'>
								{history.map((entry) => (
									<OrderCard key={entry.order.id} entry={entry} />
								))}
							</div>
						</section>
					)}
				</>
			)}
		</div>
	)
}

/** Баннер привязки email (этап 3, Q5): CTA дублирует пункт меню профиля */
function EmailBanner() {
	return (
		<Card className='border-primary/40 bg-primary/5'>
			<CardContent className='flex flex-wrap items-center justify-between gap-3 py-4'>
				<p className='text-sm'>Подтвердите email, чтобы получать уведомления о заказах</p>
				<Button size='sm' asChild>
					<Link href='/email'>Привязать email</Link>
				</Button>
			</CardContent>
		</Card>
	)
}

function OrderCard({ entry, current = false }: { entry: UserOrder; current?: boolean }) {
	const { order, items } = entry
	// формула квитанции: Σ позиций − скидка + доставка
	const total =
		items.reduce((sum, item) => sum + item.price * item.qty, 0) -
		order.discountAmount +
		order.deliveryFee
	const totalQty = items.reduce((sum, item) => sum + item.qty, 0)

	return (
		// вся карточка — ссылка (2026-11-16): кнопка «Открыть» убрана
		<Link
			href={`/orders/${order.id}`}
			className='group/card block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
		>
			<Card
				className={cn(
					'transition-[--tw-ring-color] group-hover/card:ring-primary/40',
					current && 'ring-primary/40',
				)}
			>
				<CardHeader>
					<CardTitle className='flex flex-wrap items-center gap-2'>
						Заказ № {order.id.slice(0, 8)}
						<Badge variant='secondary'>
							{/* status — text-колонка: невалидное значение не маскируем кастомом (ревью S7) */}
							{STATUS_LABELS[order.status as OrderStatus] ?? order.status}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className='text-sm text-muted-foreground'>
					<span>{formatDate(order.createdAt)}</span>
					<span aria-hidden> · </span>
					<span>{totalQty} шт.</span>
					<span aria-hidden> · </span>
					<span className='font-medium text-foreground tabular-nums'>{formatPrice(total)}</span>
				</CardContent>
			</Card>
		</Link>
	)
}

function OrdersSkeleton() {
	return (
		<div className='space-y-3 pt-6' aria-hidden>
			<Skeleton className='h-8 w-48 rounded-md' />
			<Skeleton className='h-28 w-full rounded-lg' />
			<Skeleton className='h-28 w-full rounded-lg' />
		</div>
	)
}
