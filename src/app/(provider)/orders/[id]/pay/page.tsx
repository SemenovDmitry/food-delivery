import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { PayClient, type PayClientProps } from '@/components/payments/pay-client'
import { Skeleton } from '@/components/ui/skeleton'
import { isUuid } from '@/lib/id'
import { isTerminalStatus } from '@/lib/order-timeline'
import { paymentWindowMinutes } from '@/lib/payments'
import { getPayContext } from '@/queries/payments'

type PayPageProps = PageProps<'/orders/[id]/pay'>

/**
 * Страница «сайта провайдера» (этап 9, Q10): выбор банка → заглушка банка.
 * Доступ — как у трекинга: знание uuid = пропуск (Q11a-семья), сессия не читается.
 * Грани (Q7): оплачен/отменён/при получении/без payment-строки → redirect на
 * трекинг; не-uuid/не найден → notFound (§5.24).
 */
export default function PayPage({ params }: PayPageProps) {
	return (
		<Suspense fallback={<PaySkeleton />}>
			<PayContent params={params} />
		</Suspense>
	)
}

async function PayContent({ params }: { params: Promise<{ id: string }> }) {
	// uncached-чтения не должны исполняться на пререндере сборки (§5.33)
	await connection()
	const { id } = await params

	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(id)) notFound()

	const context = await getPayContext(id)
	if (!context) notFound()

	const { order, payment } = context

	// оплачен — платить нечего; отменён (любая причина) — баннер на трекинге;
	// при получении — карта не нужна; payment-строки нет — аномалия, на трекинг
	if (
		order.paymentStatus === 'paid' ||
		isTerminalStatus(order.status) ||
		order.paymentMethod !== 'online' ||
		!payment
	) {
		redirect(`/orders/${id}`)
	}

	const props: PayClientProps = {
		orderId: order.id,
		amount: payment.amount,
		createdAtIso: order.createdAt.toISOString(),
		windowMinutes: paymentWindowMinutes(),
		paymentStatus: payment.status,
		providers: context.providers.map((p) => ({ code: p.code, label: p.label })),
	}

	return <PayClient {...props} />
}

function PaySkeleton() {
	return (
		<div className='space-y-4' aria-hidden>
			<Skeleton className='h-24 w-full rounded-lg' />
			<Skeleton className='h-64 w-full rounded-lg' />
		</div>
	)
}
