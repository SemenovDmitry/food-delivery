import type { Metadata } from 'next'
import { connection } from 'next/server'
import { PromotionForm } from '@/components/admin/promotion-form'
import { getCategoriesSimple } from '@/queries/categories'

export const metadata: Metadata = { title: 'Новая акция' }

export default async function AdminPromotionNewPage() {
	// §5.3: uncached-запрос — только после гейта (не исполнять на пререндере)
	await connection()
	const categories = await getCategoriesSimple()

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Новая акция</h2>
			<PromotionForm categories={categories} />
		</div>
	)
}
