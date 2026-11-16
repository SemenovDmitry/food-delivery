import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ProductForm } from '@/components/admin/product-form'
import { Skeleton } from '@/components/ui/skeleton'
import { isUuid } from '@/lib/id'
import { imageUrlFor } from '@/lib/s3'
import { getCategoriesSimple } from '@/queries/categories'
import { getAdminProduct, getProductsSimple } from '@/queries/products'

export const metadata: Metadata = { title: 'Товар' }

/**
 * Редактирование товара (этап 5). params/сессия — динамические данные:
 * читаются в скоупе под <Suspense> (паттерн квитанции этапа 4, §5.3),
 * иначе prerender-гейт валит build («blocking route»).
 */
export default function AdminProductEditPage({ params }: PageProps<'/admin/products/[id]'>) {
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

	const [data, categories, productOptions] = await Promise.all([
		getAdminProduct(id),
		getCategoriesSimple(),
		getProductsSimple(),
	])
	if (!data) notFound()

	const { product, components } = data

	return (
		<>
			<h2 className='text-xl font-semibold'>Товар: {product.name}</h2>
			<ProductForm
				categories={categories}
				imageSrc={imageUrlFor(product.imageUrl)}
				productOptions={productOptions.filter((option) => option.id !== product.id)}
				product={{
					id: product.id,
					name: product.name,
					description: product.description,
					price: product.price,
					type: product.type === 'set' ? 'set' : 'single',
					emoji: product.emoji,
					categoryId: product.categoryId,
					isActive: product.isActive,
					components: components.map((component) => ({
						productId: component.productId,
						qty: component.qty,
					})),
				}}
			/>
		</>
	)
}
