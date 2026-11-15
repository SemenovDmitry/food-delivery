import { Footer } from '@/components/shop/footer'
import { Header } from '@/components/shop/header'

/** Каркас магазина: header/footer; модалка товара живёт в карточке (§5.22) */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='flex min-h-svh flex-col'>
			<Header />
			<div className='flex-1'>{children}</div>
			<Footer />
		</div>
	)
}
