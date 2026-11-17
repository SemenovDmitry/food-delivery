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
	paymentMethod,
	paymentStatus,
}: {
	orderId: string
	status: OrderStatus
	fulfillment: Fulfillment
	/** этап 9, Q18: неоплаченный онлайн не стартует — select задизейблен с подсказкой */
	paymentMethod: string
	paymentStatus: string
}) {
	const [isPending, startTransition] = useTransition()
	const [current, applyStatus] = useOptimistic(status, (_cur, next: OrderStatus) => next)
	const gated = paymentMethod === 'online' && paymentStatus === 'pending'
	const legalOptions = isOrderStatus(current) ? nextStatuses(current, fulfillment) : []
	// этап 9, Q18: неоплаченный онлайн не стартует кухней — из опций остаётся
	// только живой отказ (cancelled_by_vendor); серверный гвард страхует preparing.
	// Select НЕ дизейблится целиком — иначе админ не смог бы отказать (спека требует обе половины)
	const options = gated
		? legalOptions.filter((next) => next === 'cancelled_by_vendor')
		: legalOptions
	const disabled = isPending || legalOptions.length === 0

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
			<Select value={current} onValueChange={change} disabled={disabled}>
				<SelectTrigger
					size='sm'
					aria-label={
						gated
							? `Заказ № ${orderId.slice(0, 8)} ожидает оплаты`
							: `Сменить статус заказа № ${orderId.slice(0, 8)}`
					}
					title={gated ? 'Кухня не стартует до оплаты' : undefined}
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
			{/* гвард сервера страхует UI независимо (Q18); подпись — текстом (§7) */}
			{gated && <span className='text-xs text-muted-foreground'>Ожидает оплаты</span>}
			{/* смена статуса объявляется текстом, не только цветом бейджа (§7) */}
			<span aria-live='polite' className='sr-only'>
				Статус: {isOrderStatus(current) ? STATUS_LABELS[current] : current}
			</span>
		</span>
	)
}
