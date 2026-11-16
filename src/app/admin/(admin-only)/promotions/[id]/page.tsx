import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PromotionForm } from '@/components/admin/promotion-form'
import { Skeleton } from '@/components/ui/skeleton'
import { isUuid } from '@/lib/id'
import { getCategoriesSimple } from '@/queries/categories'
import { getPromotionById } from '@/queries/promotions'

export const metadata: Metadata = { title: 'Акция' }

/** params/сессия — под <Suspense> (паттерн квитанции, §5.3) — см. products/[id] */
export default function AdminPromotionEditPage({ params }: PageProps<'/admin/promotions/[id]'>) {
	return (
		<div className='space-y-4'>
			<Suspense fallback={<Skeleton className='h-96 w-full rounded-lg' aria-hidden />}>
				<EditContent params={params} />
			</Suspense>
		</div>
	)
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	// кривой uuid роняет запрос в Postgres — отсекаем до БД (§5.24)
	if (!isUuid(id)) notFound()

	const [promo, categories] = await Promise.all([getPromotionById(id), getCategoriesSimple()])
	if (!promo) notFound()

	return (
		<>
			<h2 className='text-xl font-semibold'>Акция: {promo.name}</h2>
			<PromotionForm
				categories={categories}
				promotion={{
					id: promo.id,
					name: promo.name,
					code: promo.code,
					discountType: promo.discountType === 'fixed' ? 'fixed' : 'percent',
					discountValue: promo.discountValue,
					categoryId: promo.categoryId,
					minTotal: promo.minTotal,
					startsAt: promo.startsAt,
					endsAt: promo.endsAt,
					isActive: promo.isActive,
					isPublic: promo.isPublic,
				}}
			/>
		</>
	)
}
