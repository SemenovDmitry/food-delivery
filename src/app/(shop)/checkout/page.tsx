import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { CheckoutForm } from '@/components/shop/checkout-form'
import { Skeleton } from '@/components/ui/skeleton'
import { loadCartViewData } from '@/lib/cart-view-data'
import { enforceNotBlocked, getSession } from '@/lib/session'

type CheckoutPageProps = PageProps<'/checkout'>

/** /checkout — подтверждение заказа: товары read-only + форма (тикет 05) */
export default function CheckoutPage({ searchParams }: CheckoutPageProps) {
	return (
		<main id='main-content' className='mx-auto max-w-6xl px-4 pb-16'>
			<h1 className='pt-6 text-2xl font-bold'>Оформление заказа</h1>
			<Suspense fallback={<CheckoutSkeleton />}>
				<CheckoutContent searchParams={searchParams} />
			</Suspense>
		</main>
	)
}

async function CheckoutContent({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	// fulfillment выбран на /cart и доезжает через query (Q19); финальный — payload
	const params = await searchParams
	const initialFulfillment = params.fulfillment === 'pickup' ? 'pickup' : 'delivery'

	const data = await loadCartViewData()
	if (!data) {
		// чекаут с пустой корзиной невозможен — направляем редактировать (Q4)
		redirect('/cart')
	}

	const session = await getSession()
	await enforceNotBlocked() // забаненный/архивированный — срез до подтверждения заказа (этап 5, Q14)

	return (
		<CheckoutForm
			lines={data.lines}
			activePromo={data.activePromo}
			delivery={data.delivery}
			initialFulfillment={initialFulfillment}
			initialName={session?.user.name ?? ''}
			initialPhone={session?.user.phoneNumber ?? ''}
		/>
	)
}

function CheckoutSkeleton() {
	return (
		<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' aria-hidden>
			<div className='space-y-3'>
				<Skeleton className='h-32 w-full rounded-lg' />
				<Skeleton className='h-64 w-full rounded-lg' />
			</div>
			<Skeleton className='h-64 w-full rounded-lg' />
		</div>
	)
}
