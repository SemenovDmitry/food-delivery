'use client'

import { cn } from 'cn'
import { useOptimistic, useTransition } from 'react'
import { toast } from 'sonner'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import type { OrderStatus } from '@/db/schema'
import { updateOrderStatus } from '@/lib/actions/orders'
import { STATUS_LABELS } from '@/lib/format'
import { type Fulfillment, isOrderStatus, nextStatuses } from '@/lib/order-timeline'

/**
 * Inline-смена статуса в /admin/orders (этап 5, Q10): select показывает только
 * легальные следующие статусы (nextStatuses — та же карта, что валидирует
 * сервер), оптимистика через useOptimistic (паттерн cart-interactive).
 * Терминальный заказ — select задизейблен. Ошибка сервера → toast + откат
 * оптимистики (useOptimistic откатывается сам при конце transition).
 */
export function OrderStatusCell({
	orderId,
	status,
	fulfillment,
}: {
	orderId: string
	status: OrderStatus
	fulfillment: Fulfillment
}) {
	const [isPending, startTransition] = useTransition()
	const [current, applyStatus] = useOptimistic(status, (_cur, next: OrderStatus) => next)
	const options = isOrderStatus(current) ? nextStatuses(current, fulfillment) : []

	function change(next: string) {
		startTransition(async () => {
			applyStatus(next as OrderStatus)
			const result = await updateOrderStatus(orderId, next)
			if (result.data === null) {
				toast.error(result.error)
			}
		})
	}

	return (
		<span className='inline-flex items-center gap-2'>
			<Select value={current} onValueChange={change} disabled={options.length === 0 || isPending}>
				<SelectTrigger
					size='sm'
					aria-label={`Сменить статус заказа № ${orderId.slice(0, 8)}`}
					className={cn('w-44', isPending && 'opacity-60')}
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{/* текущий — первый пункт (value совпадает с ним) */}
					{isOrderStatus(current) && (
						<SelectItem value={current}>{STATUS_LABELS[current]}</SelectItem>
					)}
					{options.map((option) => (
						<SelectItem key={option} value={option}>
							{STATUS_LABELS[option]}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{/* смена статуса объявляется текстом, не только цветом бейджа (§7) */}
			<span aria-live='polite' className='sr-only'>
				Статус: {isOrderStatus(current) ? STATUS_LABELS[current] : current}
			</span>
		</span>
	)
}
