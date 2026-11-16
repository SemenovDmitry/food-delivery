'use client'

import { CircleX, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/shop/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cancelOrder } from '@/lib/actions/orders'
import { formatDateTime, STATUS_LABELS } from '@/lib/format'
import { CANCELLABLE_STATUSES, isOrderStatus, isTerminalStatus } from '@/lib/order-timeline'

const POLL_INTERVAL_MS = 25_000

/** Контракт GET /api/orders/[id] (тикет 03): даты — ISO-строки */
type OrderStatusDto = { status: string; paymentStatus: string; updatedAt: string }

type OrderTrackerProps = {
	orderId: string
	/** text-колонка — приходит строкой, валидация в isOrderStatus (ревью S7) */
	initialStatus: string
	updatedAt: string
}

/**
 * Трекинг (этап 4, гриллинг Q1/Q6): начальный статус из RSC, дальше — поллинг
 * 25 с с ETag (304 → пустое тело, экономия; 200 → setState). Ошибки сети и 404
 * молча ждут следующего тика, терминальный статус замолкает навсегда.
 * 4-бис (2026-11-16): цепочка шагов заменена цветным бейджем статуса.
 */
export function OrderTracker({ orderId, initialStatus, updatedAt }: OrderTrackerProps) {
	const [status, setStatus] = useState(initialStatus)
	const [statusUpdatedAt, setStatusUpdatedAt] = useState(updatedAt)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [isCancelling, startCancel] = useTransition()

	// Зеркала для колбэка интервала: эффект не пересоздаёт таймер на каждой смене статуса
	const statusRef = useRef(initialStatus)
	const etagRef = useRef<string | null>(null)

	const poll = useCallback(async () => {
		if (document.hidden) return // фоновая вкладка — тик пропущен, возврат догонит следующим тиком
		if (isTerminalStatus(statusRef.current)) return // терминальный — запросов больше не будет
		try {
			const headers: HeadersInit = {}
			if (etagRef.current !== null) headers['If-None-Match'] = etagRef.current
			const response = await fetch(`/api/orders/${orderId}`, { headers })
			if (!response.ok) return // 404/5xx — страница уже отрендерена, ждём следующего тика
			etagRef.current = response.headers.get('etag')
			const dto = (await response.json()) as OrderStatusDto
			if (dto.status !== statusRef.current) {
				statusRef.current = dto.status
				setStatus(dto.status) // aria-live-регион объявит новый статус (см. разметку)
			}
			setStatusUpdatedAt(dto.updatedAt)
		} catch {
			// сеть упала — молча, без бэккофа и UI-ошибки (гриллинг Q6)
		}
	}, [orderId])

	useEffect(() => {
		const interval = setInterval(() => void poll(), POLL_INTERVAL_MS)
		return () => clearInterval(interval)
	}, [poll])

	function handleCancel() {
		startCancel(async () => {
			const result = await cancelOrder(orderId)
			setDialogOpen(false)
			if (result.error !== null) {
				toast.error(result.error)
				return
			}
			// мгновенный баннер отмены; следующий тик подтвердит тем же ETag (Q12)
			statusRef.current = 'cancelled_by_customer'
			setStatus('cancelled_by_customer')
			toast.success('Заказ отменён')
		})
	}

	const statusLabel = isOrderStatus(status) ? STATUS_LABELS[status] : status
	const canCancel = isOrderStatus(status) && CANCELLABLE_STATUSES.includes(status)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Статус заказа</CardTitle>
				<CardAction>
					<StatusBadge status={status} className='h-6 px-2.5 text-sm' />
				</CardAction>
			</CardHeader>
			<CardContent className='space-y-4'>
				{/* смена статуса объявляется скринридеру без перезагрузки (a11y §7) */}
				<p aria-live='polite' className='sr-only'>
					Текущий статус: {statusLabel}
				</p>

				{/* отмена — баннер (гриллинг Q2) */}
				{status === 'cancelled_by_customer' && <CancelledBanner text='Вы отменили этот заказ' />}
				{status === 'cancelled_by_vendor' && (
					<CancelledBanner text='Заказ отклонён заведением — не принят' />
				)}

				<p className='text-xs text-muted-foreground'>
					Статус обновлён {formatDateTime(statusUpdatedAt)}
				</p>

				{canCancel && (
					<Button variant='outline' className='w-full' onClick={() => setDialogOpen(true)}>
						Отменить заказ
					</Button>
				)}
			</CardContent>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent role='alertdialog'>
					<DialogHeader>
						<DialogTitle>Отменить заказ?</DialogTitle>
						<DialogDescription>
							Заказ № {orderId.slice(0, 8)} будет отменён. Действие необратимо.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDialogOpen(false)}>
							Вернуться
						</Button>
						<Button variant='destructive' disabled={isCancelling} onClick={handleCancel}>
							{isCancelling && <Loader2 aria-hidden className='size-4 animate-spin' />}
							Да, отменить
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}

function CancelledBanner({ text }: { text: string }) {
	return (
		<p className='flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive'>
			<CircleX aria-hidden className='size-4 shrink-0' />
			{text}
		</p>
	)
}
