import { getCartForRead, getCartLines } from '@/lib/cart'
import { plural } from '@/lib/format'

/**
 * Σqty корзины в шапке — динамический фрагмент в Suspense-слоте (тикет 07):
 * shell кешируется, счётчик читает cookies. Без тегов — server actions сами
 * пере-рендерят текущий маршрут, при навигации динамика всегда свежая.
 */
export async function CartBadge() {
	const cart = await getCartForRead()
	if (!cart) {
		return <span className='sr-only'>Корзина пуста</span>
	}

	const lines = await getCartLines(cart.id)
	const totalQty = lines.reduce((sum, line) => sum + line.qty, 0)
	if (totalQty === 0) {
		return <span className='sr-only'>Корзина пуста</span>
	}

	return (
		<>
			<span
				aria-hidden
				className='absolute -right-1.5 -top-1.5 grid size-4.5 min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground'
			>
				{totalQty > 99 ? '99+' : totalQty}
			</span>
			<span className='sr-only'>
				В корзине {totalQty} {plural(totalQty, 'товар', 'товара', 'товаров')}
			</span>
		</>
	)
}

export function CartBadgeSkeleton() {
	return (
		<>
			<span className='sr-only'>Корзина</span>
			<div aria-hidden className='h-9 w-9 animate-pulse rounded-md bg-muted' />
		</>
	)
}
