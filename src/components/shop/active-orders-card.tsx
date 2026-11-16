import { cn } from 'cn'
import Link from 'next/link'
import { StatusBadge } from '@/components/shop/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/format'
import { ACTIVE_STATUSES, isOrderStatus } from '@/lib/order-timeline'
import { getSession } from '@/lib/session'
import type { UserOrder } from '@/queries/orders'
import { getUserOrders } from '@/queries/orders'

/**
 * «Активные заказы» на главной (этап 4, гриллинг Q10): Suspense-слот над
 * «Акциями недели» — чтение сессии динамическое (§5.3), гость слота не видит.
 * Показываются ВСЕ активные заказы (не один), без поллинга: живое обновление —
 * на странице трекинга. Пусто → слот не рендерится вовсе.
 */
export async function ActiveOrdersSection() {
	const session = await getSession()
	if (!session) return null

	const allOrders = await getUserOrders(session.user.id)
	const active = allOrders.filter(
		(entry) => isOrderStatus(entry.order.status) && ACTIVE_STATUSES.includes(entry.order.status),
	)
	if (active.length === 0) return null

	return (
		<section aria-labelledby='active-orders-heading' className='mx-auto max-w-6xl px-4 pt-6'>
			<h2 id='active-orders-heading' className='text-2xl font-bold'>
				Активные заказы
			</h2>
			<div className='mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
				{active.map((entry) => (
					<ActiveOrderCard key={entry.order.id} entry={entry} />
				))}
			</div>
		</section>
	)
}

/** Вся карточка — ссылка на трекинг (паттерн карточек /orders, 2df9cad) */
function ActiveOrderCard({ entry }: { entry: UserOrder }) {
	const { order, items } = entry
	// формула квитанции: Σ позиций − скидка + доставка
	const total =
		items.reduce((sum, item) => sum + item.price * item.qty, 0) -
		order.discountAmount +
		order.deliveryFee
	const totalQty = items.reduce((sum, item) => sum + item.qty, 0)

	return (
		<Link
			href={`/orders/${order.id}`}
			className='group/card block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
		>
			<Card
				className={cn(
					'transition-[--tw-ring-color] group-hover/card:ring-primary/40',
					'ring-primary/40',
				)}
			>
				<CardHeader>
					<CardTitle className='flex flex-wrap items-center gap-2'>
						Заказ № {order.id.slice(0, 8)}
						{/* фильтр выше пропускает только ACTIVE_STATUSES */}
						<StatusBadge status={order.status} />
					</CardTitle>
				</CardHeader>
				<CardContent className='text-sm text-muted-foreground'>
					<span>{totalQty} шт.</span>
					<span aria-hidden> · </span>
					<span className='font-medium text-foreground tabular-nums'>{formatPrice(total)}</span>
				</CardContent>
			</Card>
		</Link>
	)
}
