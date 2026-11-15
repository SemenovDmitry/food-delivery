import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ProductDetails } from '@/components/shop/product-details'
import { Skeleton } from '@/components/ui/skeleton'
import { getProduct } from '@/queries/menu'

type ProductPageProps = PageProps<'/product/[id]'>

/** Fallback: прямой заход по ссылке /product/[id] — полная страница товара */

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
	const { id } = await params
	const product = await getProduct(id)
	if (!product) return { title: 'Товар не найден' }
	return { title: product.name, description: product.description ?? undefined }
}

export default function ProductPage({ params }: ProductPageProps) {
	// params — динамическое чтение: в Suspense, await внутри (§5.3)
	return (
		<main id='main-content'>
			<Suspense fallback={<ProductPageSkeleton />}>
				<ProductContent params={params} />
			</Suspense>
		</main>
	)
}

async function ProductContent({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params
	const product = await getProduct(id)
	if (!product) notFound()

	return <ProductDetails product={product} />
}

function ProductPageSkeleton() {
	return (
		<div className='mx-auto max-w-2xl px-4 py-8' aria-hidden>
			<Skeleton className='h-8 w-64' />
			<Skeleton className='mt-4 h-44 w-full rounded-lg' />
			<Skeleton className='mt-4 h-6 w-40' />
		</div>
	)
}
