'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AddToCartButton } from '@/components/shop/add-to-cart-button'
import { PriceLine } from '@/components/shop/price-line'
import { ProductDetails } from '@/components/shop/product-details'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MenuProduct } from '@/queries/menu'

/**
 * Карточка товара. Модалка синхронизирована с URL-параметром `?product=<id>`
 * (источник правды — URL): клик пишет параметр через pushState (кнопка Back
 * закрывает модалку), deep-link `/?product=<id>` открывает каталог сразу
 * с модалкой. Якорная навигация #pizza/#sets остаётся свободной (§5.22).
 * Прямой заход на /product/<id> — fallback-страница.
 */
export function ProductCard({ product }: { product: MenuProduct }) {
	const searchParams = useSearchParams()
	const [open, setOpen] = useState(false)
	/** модалка открыта кликом (в истории есть запись) или пришла по ссылке */
	const pushedRef = useRef(false)

	// URL — источник правды: параметр появился (deep-link/Back/Forward) → открыть, исчез → закрыть
	const urlProduct = searchParams.get('product')
	useEffect(() => {
		setOpen(urlProduct === product.id)
	}, [urlProduct, product.id])

	const openModal = (e: React.MouseEvent) => {
		// средний клик/модификаторы — отдаём браузеру (открыть в новой вкладке)
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
		e.preventDefault()
		const params = new URLSearchParams(window.location.search)
		params.set('product', product.id)
		window.history.pushState(null, '', `/?${params.toString()}`)
		setOpen(true)
		pushedRef.current = true
	}

	const closeModal = (next: boolean) => {
		setOpen(next)
		if (!next) {
			if (pushedRef.current) {
				pushedRef.current = false
				window.history.back() // снимаем запись с параметром, URL возвращается на каталог
			} else {
				// модалка пришла по ссылке: убираем параметр без лишней записи истории
				const params = new URLSearchParams(window.location.search)
				params.delete('product')
				const qs = params.toString()
				window.history.replaceState(null, '', qs ? `/?${qs}` : '/')
			}
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
