import type { Metadata } from 'next'
import { connection } from 'next/server'
import { CategoriesAdmin } from '@/components/admin/categories-admin'
import { getCategoriesWithCounts } from '@/queries/categories'

export const metadata: Metadata = { title: 'Категории' }

export default async function AdminCategoriesPage() {
	// §5.3: uncached-запрос до динамического примитива исполнился бы на
	// пререндере docker build (запрос в БД из образа) — гейт ДО запроса
	await connection()
	const rows = await getCategoriesWithCounts()

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Категории</h2>
			<CategoriesAdmin categories={rows} />
		</div>
	)
}
