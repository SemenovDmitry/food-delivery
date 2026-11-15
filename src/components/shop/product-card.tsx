'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AddToCartButton } from '@/components/shop/add-to-cart-button'
import { PriceLine } from '@/components/shop/price-line'
import { ProductDetails } from '@/components/shop/product-details'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MenuProduct } from '@/queries/menu'

/**
 * Карточка товара. Клик открывает модалку на клиентском состоянии, URL
 * дополняется хэшем `#product=<id>` через replaceState (ссылку можно передать —
 * каталог откроется сразу с этой модалкой). Замена записи вместо push/back:
 * сырой pushState/back в Next 16 конфликтует с управлением историей (§5.22).
 * Прямой заход на /product/<id> — fallback-страница.
 */
export function ProductCard({ product }: { product: MenuProduct }) {
	const [open, setOpen] = useState(false)
	const hash = `#product=${product.id}`

	// deep-link: /#product=<id> → каталог открывается сразу с модалкой
	useEffect(() => {
		if (window.location.hash === hash) setOpen(true)
	}, [hash])

	const openModal = (e: React.MouseEvent) => {
		// средний клик/модификаторы — отдаём браузеру (открыть в новой вкладке)
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
		e.preventDefault()
		setOpen(true)
		window.history.replaceState(null, '', hash)
	}

	const closeModal = (next: boolean) => {
		setOpen(next)
		if (!next) {
			window.history.replaceState(null, '', window.location.pathname + window.location.search)
		}
	}

	return (
		<article className='flex flex-col overflow-hidden rounded-xl border'>
			<Link
				href={`/product/${product.id}`}
				onClick={openModal}
				className='flex h-36 items-center justify-center bg-muted text-5xl'
				aria-label={`Открыть «${product.name}»`}
			>
				{product.imageUrl ? (
					<Image
						src={product.imageUrl}
						alt={product.name}
						width={288}
						height={144}
						className='size-full object-cover'
					/>
				) : (
					<span aria-hidden>{product.emoji}</span>
				)}
			</Link>
			<div className='flex flex-1 flex-col gap-1 p-3'>
				<h3 className='font-semibold'>
					<Link
						href={`/product/${product.id}`}
						onClick={openModal}
						className='transition-colors hover:text-primary'
					>
						{product.name}
					</Link>
				</h3>
				{product.description ? (
					<p className='line-clamp-2 text-sm text-muted-foreground'>{product.description}</p>
				) : null}
				{product.type === 'set' && product.setComponents.length > 0 ? (
					<p className='text-xs text-muted-foreground'>
						Состав:{' '}
						{product.setComponents
							.map((c) => `${c.name}${c.qty > 1 ? ` ×${c.qty}` : ''}`)
							.join(', ')}
					</p>
				) : null}
				<div className='mt-auto pt-2'>
					<PriceLine price={product.price} oldPrice={product.setOldPrice} />
				</div>
				<div className='pt-2'>
					<AddToCartButton productId={product.id} size='lg' fullWidth />
				</div>
			</div>

			<Dialog open={open} onOpenChange={closeModal}>
				<DialogContent className='max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md'>
					<DialogHeader>
						<DialogTitle>{product.name}</DialogTitle>
					</DialogHeader>
					{/* after success — закрываем диалог (шагтер с кнопкой внутри деталей) */}
					<ProductDetails product={product} onAdded={() => setOpen(false)} />
				</DialogContent>
			</Dialog>
		</article>
	)
}
