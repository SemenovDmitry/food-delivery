'use client'

import { CircleX, CreditCard, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/shop/status-badge'
import { Badge } from '@/components/ui/badge'
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
	/** способ оплаты (этап 9, Q16): online | on_receipt */
	initialPaymentMethod: string
	/** pending | paid — чип оплаты доезжает тем же поллингом (Q9) */
	initialPaymentStatus: string
	updatedAt: string
}

/**
 * Трекинг (этап 4, гриллинг Q1/Q6): начальный статус из RSC, дальше — поллинг
 * 25 с с ETag (304 → пустое тело, экономия; 200 → setState). Ошибки сети и 404
 * молча ждут следующего тика, терминальный статус замолкает навсегда.
 * 4-бис (2026-11-16): цепочка шагов заменена цветным бейджем статуса.
 * Оплата (этап 9, Q9): платёжный чип ВСЕГДА (виден и держателю uuid — статус
 * оплаты не чувствителен, Q11a-семантика); online+pending → CTA «Оплатить»
 * на страницу провайдера.
 */
export function OrderTracker({
	orderId,
	initialStatus,
	initialPaymentMethod,
	initialPaymentStatus,
	updatedAt,
}: OrderTrackerProps) {
	const [status, setStatus] = useState(initialStatus)
	const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus)
	const [statusUpdatedAt, setStatusUpdatedAt] = useState(updatedAt)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [isCancelling, startCancel] = useTransition()

	// Зеркала для колбэка интервала: эффект не пересоздаёт таймер на каждой смене статуса
	const statusRef = useRef(initialStatus)
	const paymentStatusRef = useRef(initialPaymentStatus)
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
			if (dto.paymentStatus !== paymentStatusRef.current) {
				paymentStatusRef.current = dto.paymentStatus
				setPaymentStatus(dto.paymentStatus) // чип «Ожидает оплаты» → «Оплачено» без перезагрузки
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
	const isOnline = initialPaymentMethod === 'online'
	const canPay = isOnline && paymentStatus === 'pending' && !isTerminalStatus(status)

	return (
		<Card>
			<CardHeader>
				<CardTitle>Статус заказа</CardTitle>
				<CardAction className='flex items-center gap-2'>
					<PaymentChip
						paymentMethod={initialPaymentMethod}
						paymentStatus={paymentStatus}
						orderStatus={status}
					/>
					<StatusBadge status={status} className='h-6 px-2.5 text-sm' />
				</CardAction>
			</CardHeader>
			<CardContent className='space-y-4'>
				{/* смена статуса объявляется скринридеру без перезагрузки (a11y §7) */}
				<p aria-live='polite' className='sr-only'>
					Текущий статус: {statusLabel}
				</p>

				{/* отмена — баннер (гриллинг Q2); timeout — свой текст (этап 9, Q17) */}
				{status === 'cancelled_by_customer' && <CancelledBanner text='Вы отменили этот заказ' />}
				{status === 'cancelled_by_vendor' && (
					<CancelledBanner text='Заказ отклонён заведением — не принят' />
				)}
				{status === 'cancelled_by_timeout' && (
					<CancelledBanner text='Время оплаты истекло — заказ отменён автоматически' />
				)}

				<p className='text-xs text-muted-foreground'>
					Статус обновлён {formatDateTime(statusUpdatedAt)}
				</p>

				{canPay && (
					<Button asChild className='w-full'>
						<Link href={`/orders/${orderId}/pay`}>
							<CreditCard aria-hidden className='size-4' />
							Оплатить заказ
						</Link>
					</Button>
				)}

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

/**
 * Платёжный чип (этап 9, Q9) — текст, не только цвет (§7): online+pending
 * «Ожидает оплаты» (info-токен), paid «Оплачено» (success); on_receipt
 * «При получении» (нейтральный) — включая оплаченные при передаче (Q21).
 * На отменённых заказах чип скрыт — причину объясняет баннер отмены
 * (ревью: «Ожидает оплаты» рядом с «Отменён» — семантический шум).
 */
function PaymentChip({
	paymentMethod,
	paymentStatus,
	orderStatus,
}: {
	paymentMethod: string
	paymentStatus: string
	orderStatus: string
}) {
	if (orderStatus.startsWith('cancelled_')) return null
	if (paymentMethod !== 'online') {
		// on_receipt: после получения заказ уже оплачен (Q21) — «При получении» без лжи
		const collected = isTerminalStatus(orderStatus) && paymentStatus === 'paid'
		return (
			<Badge variant='outline' className='h-6 px-2.5 text-sm text-muted-foreground'>
				{collected ? 'Оплачено при получении' : 'При получении'}
			</Badge>
		)
	}
	if (paymentStatus === 'paid') {
		return (
			<Badge
				variant='outline'
				className='h-6 border-status-success/30 bg-status-success/10 px-2.5 text-sm text-status-success'
			>
				Оплачено
			</Badge>
		)
	}
	return (
		<Badge
			variant='outline'
			className='h-6 border-status-info/30 bg-status-info/10 px-2.5 text-sm text-status-info'
		>
			Ожидает оплаты
		</Badge>
	)
}
