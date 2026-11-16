'use client'

import { Loader2, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { repeatOrder } from '@/lib/actions/orders'

type RepeatOrderButtonProps = {
	orderId: string
}

/**
 * «Повторить заказ» (над карточкой квитанции, 2026-11-16): снапшот позиций
 * → текущая корзина → /cart. 0 добавленных = товары больше недоступны.
 */
export function RepeatOrderButton({ orderId }: RepeatOrderButtonProps) {
	const router = useRouter()
	const [isPending, startTransition] = useTransition()

	return (
		<Button
			variant='outline'
			size='sm'
			disabled={isPending}
			onClick={() =>
				startTransition(async () => {
					const result = await repeatOrder(orderId)
					if (result.error !== null) {
						toast.error(result.error)
						return
					}
					if (result.data.added === 0) {
						toast.error('Товары из этого заказа больше недоступны')
						return
					}
					toast.success(`Добавлено в корзину: ${result.data.added} поз.`)
					router.push('/cart')
				})
			}
		>
			{isPending ? (
				<Loader2 aria-hidden className='size-4 animate-spin' />
			) : (
				<RotateCcw aria-hidden className='size-4' />
			)}
			Повторить заказ
		</Button>
	)
}
