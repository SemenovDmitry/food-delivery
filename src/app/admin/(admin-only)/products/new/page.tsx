import type { Metadata } from 'next'
import { connection } from 'next/server'
import { ProductForm } from '@/components/admin/product-form'
import { getCategoriesSimple } from '@/queries/categories'
import { getProductsSimple } from '@/queries/products'

export const metadata: Metadata = { title: 'Новый товар' }

export default async function AdminProductNewPage() {
	// §5.3: uncached-запросы — только после гейта (не исполнять на пререндере)
	await connection()
	const [categories, productOptions] = await Promise.all([
		getCategoriesSimple(),
		getProductsSimple(),
	])

	return (
		<div className='space-y-4'>
			<h2 className='text-xl font-semibold'>Новый товар</h2>
			<ProductForm categories={categories} productOptions={productOptions} />
		</div>
	)
}
