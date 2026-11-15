import Link from 'next/link'
import { Suspense } from 'react'
import { CartInteractive } from '@/components/shop/cart-interactive'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { loadCartViewData } from '@/lib/cart-view-data'

type CartPageProps = PageProps<'/cart'>

/** /cart — редактирование корзины: степперы, промо-блок, тоталы (тикет 03) */
export default function CartPage({ searchParams }: CartPageProps) {
	return (
		<main id='main-content' className='mx-auto max-w-6xl px-4 pb-16'>
			<h1 className='pt-6 text-2xl font-bold'>Корзина</h1>
			<Suspense fallback={<CartSkeleton />}>
				<CartContent searchParams={searchParams} />
			</Suspense>
		</main>
	)
}

async function CartContent({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
	// cookies и окно акций — динамика в Suspense (§5.3)
	const params = await searchParams
	const promoQuery = typeof params.promo === 'string' ? params.promo : ''

	const data = await loadCartViewData()
	if (!data) {
		return <CartEmpty />
	}

	return (
		<CartInteractive
			lines={data.lines}
			activePromo={data.activePromo}
			availablePromos={data.availablePromos}
			delivery={data.delivery}
			promoQuery={promoQuery}
		/>
	)
}

function CartEmpty() {
	return (
		<Card className='mt-6'>
			<CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
				<p aria-hidden className='text-5xl'>
					🛒
				</p>
				<p className='text-lg font-semibold'>Корзина пуста</p>
				<p className='text-sm text-muted-foreground'>Загляните в меню — там шаурма и пицца</p>
				<Button asChild className='mt-2'>
					<Link href='/'>В меню</Link>
				</Button>
			</CardContent>
		</Card>
	)
}

function CartSkeleton() {
	return (
		<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' aria-hidden>
			<div className='space-y-3'>
				<Skeleton className='h-40 w-full rounded-lg' />
				<Skeleton className='h-24 w-full rounded-lg' />
				<Skeleton className='h-24 w-full rounded-lg' />
			</div>
			<Skeleton className='h-72 w-full rounded-lg' />
		</div>
	)
}
