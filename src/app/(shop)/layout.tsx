import { Suspense } from 'react'
import { CartBadge, CartBadgeSkeleton } from '@/components/shop/cart-badge'
import { Footer } from '@/components/shop/footer'
import { Header } from '@/components/shop/header'

/**
 * Каркас магазина: header/footer; модалка товара живёт в карточке (§5.22).
 * Бейдж корзины — динамический Suspense-слот: shell остаётся кешируемым (тикет 07).
 */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex min-h-svh flex-col'>
			<Header
				cartSlot={
					<Suspense fallback={<CartBadgeSkeleton />}>
						<CartBadge />
					</Suspense>
				}
			/>
			<div className='flex-1'>{children}</div>
			<Footer />
		</div>
	)
}
