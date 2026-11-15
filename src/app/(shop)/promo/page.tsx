import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { PromoCard } from '@/components/shop/promo-card'
import { Skeleton } from '@/components/ui/skeleton'
import { getActivePromotions } from '@/queries/promotions'

export const metadata: Metadata = {
	title: 'Акции',
}

/**
 * /promo (этап 2): кешируемая оболочка + список в Suspense — страница ЦЕЛИКОМ
 * не кешируется (§5.3): окно акции фильтруется на чтении ВНЕ кеша, иначе
 * отрендеренный список заморозится. Только публичные акции — фильтр isPublic
 * внутри кеша (queries/promotions), скрытые промокоды сюда не попадают.
 * Тизер: без кнопок «Применить» — применение живёт в блоке акций /cart.
 */
export default function PromoPage() {
	return (
		<main id='main-content' className='mx-auto max-w-6xl px-4 pt-6 pb-16'>
			<h1 className='text-2xl font-bold'>Акции</h1>
			<Suspense fallback={<PromoGridSkeleton />}>
				<PromotionsGrid />
			</Suspense>
		</main>
	)
}

/** runtime-граница ДО кеш-запроса: окно проверяется на каждом чтении (§5.3) */
async function PromotionsGrid() {
	await connection()
	const promos = await getActivePromotions()

	if (promos.length === 0) {
		return <p className='py-6 text-sm text-muted-foreground'>Сейчас активных акций нет</p>
	}

	return (
		// sr-only h2 — уровень между h1 и h3 карточек (a11y §7: без скачков уровней)
		<section aria-labelledby='active-promos-heading' className='mt-4'>
			<h2 id='active-promos-heading' className='sr-only'>
				Активные акции
			</h2>
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{promos.map((promo) => (
					<PromoCard key={promo.id} promo={promo} />
				))}
			</div>
		</section>
	)
}

function PromoGridSkeleton() {
	return (
		<div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3' aria-hidden>
			{Array.from({ length: 3 }).map((_, i) => (
				<Skeleton key={i} className='h-28 rounded-xl' />
			))}
		</div>
	)
}
