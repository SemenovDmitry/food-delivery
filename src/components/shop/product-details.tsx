'use client'

import { Minus, Plus } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { PriceLine } from '@/components/shop/price-line'
import { Button } from '@/components/ui/button'
import { MAX_QTY } from '@/lib/constants'
import { formatPrice } from '@/lib/format'
import type { MenuProduct } from '@/queries/menu'

/**
 * Тело деталей товара (состав, степпер количества) — общее для модалки
 * в карточке и fallback-страницы /product/[id].
 */
export function ProductDetails({ product }: { product: MenuProduct }) {
	const [qty, setQty] = useState(1)

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex h-44 items-center justify-center rounded-lg bg-muted text-6xl'>
				{product.imageUrl ? (
					<Image
						src={product.imageUrl}
						alt={product.name}
						width={352}
						height={176}
						className='size-full rounded-lg object-cover'
					/>
				) : (
					<span aria-hidden>{product.emoji}</span>
				)}
			</div>

			<PriceLine price={product.price} oldPrice={product.setOldPrice} large />

			{product.description ? (
				<p className='text-sm text-muted-foreground'>{product.description}</p>
			) : null}

			{product.type === 'set' && product.setComponents.length > 0 ? (
				<div>
					<h3 className='mb-1 text-sm font-semibold'>Состав</h3>
					<ul className='list-inside list-disc text-sm text-muted-foreground'>
						{product.setComponents.map((component) => (
							<li key={component.productId}>
								{component.name}
								{component.qty > 1 ? ` ×${component.qty}` : ''} —{' '}
								{formatPrice(component.price * component.qty)}
							</li>
						))}
					</ul>
				</div>
			) : null}

			{/* Степпер количества; значение озвучивается через aria-live */}
			<div className='flex items-center gap-3'>
				<span className='text-sm text-muted-foreground'>Количество</span>
				<Button
					variant='outline'
					size='icon'
					aria-label='Уменьшить количество'
					disabled={qty <= 1}
					onClick={() => setQty((q) => Math.max(1, q - 1))}
				>
					<Minus aria-hidden className='size-4' />
				</Button>
				<span aria-live='polite' className='w-8 text-center font-semibold'>
					{qty}
				</span>
				<Button
					variant='outline'
					size='icon'
					aria-label='Увеличить количество'
					onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
				>
					<Plus aria-hidden className='size-4' />
				</Button>
			</div>
		</div>
	)
}
