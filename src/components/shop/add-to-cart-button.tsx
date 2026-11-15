'use client'

import { Loader2, ShoppingBag } from 'lucide-react'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { addToCart } from '@/lib/actions/cart'

type AddToCartButtonProps = {
	productId: string
	qty?: number
	size?: 'sm' | 'default' | 'lg'
	fullWidth?: boolean
}

/**
 * Кнопка «В корзину»: server action + useOptimistic + toast (§11).
 * Оптимистичный pending даёт мгновенную реакцию до подтверждения сервера.
 */
export function AddToCartButton({
	productId,
	qty = 1,
	size = 'sm',
	fullWidth = false,
}: AddToCartButtonProps) {
	const [isPending, startTransition] = useTransition()
	const [optimisticPending, setOptimisticPending] = useOptimistic(
		false,
		(_current, next: boolean) => next,
	)
	const busy = isPending || optimisticPending

	return (
		<Button
			size={size}
			disabled={busy}
			className={fullWidth ? 'w-full' : undefined}
			onClick={() => {
				startTransition(async () => {
					setOptimisticPending(true)
					const result = await addToCart(productId, qty)
					if (result.error === null) {
						toast.success('Добавлено в корзину')
					} else {
						toast.error(result.error)
					}
					setOptimisticPending(false)
				})
			}}
		>
			{busy ? (
				<Loader2 aria-hidden className='size-4 animate-spin' />
			) : (
				<ShoppingBag aria-hidden className='size-4' />
			)}
			В корзину
		</Button>
	)
}
