import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ProductDetails } from '@/components/shop/product-details'
import { Card, CardContent } from '@/components/ui/card'
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
		<main id='main-content' className='mx-auto max-w-2xl px-4 pb-16 pt-6'>
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

	return (
		// Card — та же «границы товара», что и на квитанции (в модалке рамку даёт Dialog)
		<Card>
			<CardContent>
				<ProductDetails product={product} />
			</CardContent>
		</Card>
	)
}

function ProductPageSkeleton() {
	return (
		<div aria-hidden>
			<Skeleton className='h-96 w-full rounded-lg' />
		</div>
	)
}
