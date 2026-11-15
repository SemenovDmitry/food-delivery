import type { OrderStatus } from '@/db/schema'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CopyLinkButton } from '@/components/shop/copy-link-button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, STATUS_LABELS } from '@/lib/format'
import { isUuid } from '@/lib/id'
import { getOrderById } from '@/queries/orders'

type ReceiptPageProps = PageProps<'/orders/[id]'>

/**
 * Квитанция заказа (тикет 06) — НЕ трекинг: этап 4 надстроит таймлайн
 * поверх этой страницы. Доступ по неугадываемому uuid (§8), поэтому без
 * сессии страница валидна — гард «владелец или uuid» этапа 4 не изменит.
 */
export default function OrderReceiptPage({ params }: ReceiptPageProps) {
	return (
		<main id='main-content' className='mx-auto max-w-2xl px-4 pb-16'>
			<Suspense fallback={<ReceiptSkeleton />}>
				<ReceiptContent params={params} />
			</Suspense>
		</main>
	)
}

async function ReceiptContent({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.23)
	if (!isUuid(id)) notFound()

	const details = await getOrderById(id)
	if (!details) notFound()

	const { order, items, promo } = details
	const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
	const total = subtotal - order.discountAmount + order.deliveryFee
	const isPickup = order.fulfillment !== 'delivery'

	return (
		<div className='pt-6'>
			<Card>
				<CardHeader>
					<CardTitle className='flex flex-wrap items-center gap-2'>
						Заказ № {order.id.slice(0, 8)}
						<Badge variant='secondary'>{STATUS_LABELS[order.status as OrderStatus]}</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					<ul className='space-y-2 text-sm'>
						{items.map((item) => (
							<li key={item.id} className='flex justify-between gap-3'>
								<span>
									{item.name} <span className='text-muted-foreground'>×{item.qty}</span>
								</span>
								<span className='tabular-nums'>{formatPrice(item.price * item.qty)}</span>
							</li>
						))}
					</ul>

					<Separator />

					<dl className='space-y-1.5 text-sm'>
						<div className='flex justify-between'>
							<dt>Товары</dt>
							<dd className='tabular-nums'>{formatPrice(subtotal)}</dd>
						</div>
						{promo && order.discountAmount > 0 && (
							<div className='flex justify-between text-primary'>
								<dt>Скидка ({promo.name})</dt>
								<dd className='tabular-nums'>−{formatPrice(order.discountAmount)}</dd>
							</div>
						)}
						<div className='flex justify-between'>
							<dt>Доставка</dt>
							<dd className='tabular-nums'>
								{isPickup
									? '—'
									: order.deliveryFee === 0
										? 'бесплатно'
										: formatPrice(order.deliveryFee)}
							</dd>
						</div>
						<div className='flex justify-between pt-1 font-semibold text-base'>
							<dt>Итого</dt>
							<dd className='tabular-nums'>{formatPrice(total)}</dd>
						</div>
					</dl>

					<Separator />

					<p className='text-sm'>
						{isPickup ? 'Способ получения: самовывоз' : `Доставка: ${order.address}`}
					</p>
					{order.comment && (
						<p className='text-sm text-muted-foreground'>Комментарий: {order.comment}</p>
					)}

					<Separator />

					<div className='rounded-lg border p-3'>
						<p className='text-sm font-medium'>Ссылка для отслеживания</p>
						<p className='mt-1 text-sm text-muted-foreground'>
							Ссылка уникальна — по ней виден статус заказа. Сохраните её.
						</p>
						<CopyLinkButton className='mt-2' />
					</div>

					<Link href='/' className='block text-center text-sm text-primary hover:underline'>
						Вернуться в меню
					</Link>
				</CardContent>
			</Card>
		</div>
	)
}

function ReceiptSkeleton() {
	return (
		<div className='pt-6' aria-hidden>
			<Skeleton className='h-72 w-full rounded-lg' />
		</div>
	)
}
