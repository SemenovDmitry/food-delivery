'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AddToCartButton } from '@/components/shop/add-to-cart-button'
import { Counter } from '@/components/shop/counter'
import { PriceLine } from '@/components/shop/price-line'
import { MAX_QTY } from '@/lib/constants'
import { formatPrice } from '@/lib/format'
import type { MenuProduct } from '@/queries/menu'

type ProductDetailsProps = {
	product: MenuProduct
	/** вызывается после успешного «В корзину» (в модалке — закрыть диалог) */
	onAdded?: () => void
}

/**
 * Тело деталей товара (состав, степпер, кнопка с выбранным количеством) —
 * общее для модалки в карточке и fallback-страницы /product/[id].
 */
export function ProductDetails({ product, onAdded }: ProductDetailsProps) {
	const [qty, setQty] = useState(1)

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex h-44 items-center justify-center rounded-lg bg-muted text-6xl'>
				{product.imageSrc ? (
					<Image
						src={product.imageSrc}
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
				<Counter
					value={qty}
					announceValue
					onDecrease={() => setQty((q) => Math.max(1, q - 1))}
					onIncrease={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
					decreaseLabel='Уменьшить количество'
					increaseLabel='Увеличить количество'
					valueClassName='font-semibold'
				/>
			</div>

			<AddToCartButton productId={product.id} qty={qty} size='lg' fullWidth onAdded={onAdded} />
		</div>
	)
}
