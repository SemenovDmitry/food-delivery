import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { CopyLinkButton } from '@/components/shop/copy-link-button'
import { OrderTotals } from '@/components/shop/order-totals'
import { OrderTracker } from '@/components/shop/order-tracker'
import { RepeatOrderButton } from '@/components/shop/repeat-order-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { isUuid } from '@/lib/id'
import { getSession } from '@/lib/session'
import { getOrderById } from '@/queries/orders'

type ReceiptPageProps = PageProps<'/orders/[id]'>

/**
 * Квитанция + трекинг (этап 4): таймлайн с поллингом 25 с над снапшотом состава.
 * Доступ по неугадываемому uuid (§8): uuid открывает статус и состав, сессия —
 * чувствительное (гриллинг Q11a): адрес/комментарий видит только владелец.
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
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(id)) notFound()

	const details = await getOrderById(id)
	if (!details) notFound()

	const { order, items, promo } = details
	const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
	const isPickup = order.fulfillment !== 'delivery'

	// getSession за connection()-гейтом (§5.3) — гость получает null без сессии
	const session = await getSession()
	const isOwner = session?.user.id === order.userId

	return (
		<div className='pt-6'>
			<div className='flex flex-wrap items-center justify-between gap-2 pb-3'>
				<h1 className='text-2xl font-bold'>Заказ № {order.id.slice(0, 8)}</h1>
				<RepeatOrderButton orderId={order.id} />
			</div>

			<div className='space-y-4'>
				<OrderTracker
					orderId={order.id}
					initialStatus={order.status}
					initialPaymentMethod={order.paymentMethod}
					initialPaymentStatus={order.paymentStatus}
					updatedAt={order.updatedAt.toISOString()}
				/>

				<Card>
					<CardHeader>
						<CardTitle>Состав заказа</CardTitle>
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

						<OrderTotals
							subtotal={subtotal}
							discountAmount={order.discountAmount}
							discountLabel={promo && order.discountAmount > 0 ? promo.name : null}
							deliveryCost={order.deliveryFee}
							isPickup={isPickup}
						/>

						<Separator />

						{isOwner ? (
							<>
								<p className='text-sm'>
									{isPickup ? 'Способ получения: самовывоз' : `Доставка: ${order.address}`}
								</p>
								{order.comment && (
									<p className='text-sm text-muted-foreground'>Комментарий: {order.comment}</p>
								)}
							</>
						) : (
							<p className='text-sm text-muted-foreground'>
								Адрес и комментарий скрыты — видны только владельцу заказа в его аккаунте
							</p>
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
